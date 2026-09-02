// Copy the LIVE data out of the hosted Supabase project into this database.
//
// The schema is already here — `npm run migrate` built it. This moves the rows,
// and only the rows. It is the step that turns "a new system" into "the same
// system on a different backend": the students, their attendance history, and
// above all their FACE EMBEDDINGS, which cannot be recreated. Losing those
// means every student re-enrolls their face.
//
// Two things make this more than a pg_dump:
//
//   1. TRIGGERS MUST BE OFF during the copy. `assign_member_code` would reissue
//      every student code on insert — codes that are printed on rosters and
//      never meant to change — and `sync_attendance_with_roster` would create
//      and delete attendance rows as the roster lands. Both fire on INSERT, so
//      a plain restore silently rewrites the data it is restoring.
//   2. Order matters. The tables are copied parents-first so foreign keys hold
//      at every step, which also means a failure leaves a consistent prefix
//      rather than a half-linked graph.
//
// Storage objects (face and probe images) are NOT handled here — they live in
// Supabase Storage, not Postgres. Run scripts/import-storage.mjs after this.
//
//   SOURCE_DATABASE_URL='postgres://postgres:…@db.<ref>.supabase.co:5432/postgres' \
//   DATABASE_URL='postgres://attendance:…@127.0.0.1:5432/attendance' \
//   node scripts/import-from-supabase.mjs --dry-run
//
// Drop --dry-run to actually write. Requires pg_dump and psql on PATH, from a
// Postgres client at least as new as the source server.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import 'dotenv/config';

const SOURCE = process.env.SOURCE_DATABASE_URL;
const TARGET = process.env.DATABASE_URL;
const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');

if (!SOURCE || !TARGET) {
  console.error(
    '[import] SOURCE_DATABASE_URL (the hosted Supabase project) and DATABASE_URL\n' +
      '         (this deployment) are both required.',
  );
  process.exit(1);
}
if (SOURCE === TARGET) {
  console.error('[import] refusing to run: source and target are the same database.');
  process.exit(1);
}

/**
 * Parents first: `members` depends on profiles / groups / branches, and
 * everything else on members.
 *
 * auth.users is NOT in this list. The target has no such table — staff password
 * hashes now live in profiles.password_hash beside the members' — so it is
 * copied by mergeStaffPasswords() below rather than restored wholesale.
 */
const TABLES = [
  'public.institutions',
  'public.branches',
  'public.groups',
  'public.shifts',
  'public.departments',
  'public.profiles',
  'public.members',
  'public.member_departments',
  'public.admin_assignments',
  'public.roster_days',
  'public.attendance',
  'public.face_templates',
  'public.qr_tokens',
  'public.presence_checks',
  'public.presence_confirmations',
  'public.audit_log',
  'storage.objects',
];

/** Rows the migrations already seeded — replaced wholesale, not appended. */
const SEEDED = ['public.app_settings'];

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024, ...opts });

async function connect(url) {
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  return c;
}

async function counts(client, tables) {
  const out = {};
  for (const t of tables) {
    try {
      const { rows } = await client.query(`select count(*)::int as n from ${t}`);
      out[t] = rows[0].n;
    } catch {
      out[t] = null; // table absent on this side
    }
  }
  return out;
}

/**
 * Fold the staff password hashes into profiles.
 *
 * On the source, a staff member's bcrypt hash is in auth.users.encrypted_password
 * (GoTrue wrote it) while a member's is in profiles.password_hash (a pgcrypto
 * function wrote it). Same format, two tables. The target keeps only the
 * second, so the hashes have to be carried across by hand.
 *
 * auth.users.id and profiles.id are the same uuid for every staff account —
 * the profile was created with the auth user's id — which is what makes this a
 * straight join. `coalesce` so a profile that somehow already has a hash keeps
 * it rather than being overwritten from a stale auth row.
 */
async function mergeStaffPasswords(src, dst) {
  const { rows } = await src.query(
    `select id, encrypted_password from auth.users where encrypted_password is not null`,
  );
  let merged = 0;
  for (const r of rows) {
    const res = await dst.query(
      `update public.profiles
          set password_hash = coalesce(password_hash, $2)
        where id = $1 and password_hash is distinct from $2`,
      [r.id, r.encrypted_password],
    );
    merged += res.rowCount;
  }
  const { rows: staff } = await dst.query(
    `select count(*)::int as n from public.profiles
      where role <> 'member' and password_hash is null`,
  );
  return { merged, staffWithoutPassword: staff[0].n };
}

async function main() {
  const src = await connect(SOURCE);
  const dst = await connect(TARGET);
  const all = [...TABLES, ...SEEDED];

  console.log('[import] reading row counts…\n');
  const before = await counts(src, all);
  const target = await counts(dst, all);

  const width = Math.max(...all.map((t) => t.length));
  console.log(`${'table'.padEnd(width)}  source   target`);
  for (const t of all) {
    console.log(`${t.padEnd(width)}  ${String(before[t] ?? '-').padStart(6)}   ${String(target[t] ?? '-').padStart(6)}`);
  }

  // A target that already holds people is either a re-run or the wrong
  // database. Either way, appending would duplicate every student.
  const occupied = TABLES.filter((t) => (target[t] ?? 0) > 0);
  if (occupied.length && !force) {
    console.error(
      `\n[import] the target is not empty: ${occupied.join(', ')}.\n` +
        `         Importing on top of existing rows duplicates them. Start from a\n` +
        `         fresh database (drop it, re-run npm run migrate), or pass --force\n` +
        `         if you have already truncated these yourself.`,
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n[import] --dry-run: nothing was written.');
    await Promise.all([src.end(), dst.end()]);
    return;
  }

  const dir = mkdtempSync(join(tmpdir(), 'attendance-import-'));
  try {
    console.log('\n[import] dumping source data…');
    const dumpFile = join(dir, 'data.sql');
    run('pg_dump', [
      SOURCE,
      '--data-only',
      '--no-owner',
      '--no-privileges',
      // Triggers off for the whole restore — see the note at the top. This is
      // why the target connection must own the tables.
      '--disable-triggers',
      ...all.flatMap((t) => ['--table', t]),
      '--file',
      dumpFile,
    ]);

    console.log('[import] clearing the seeded singletons…');
    for (const t of SEEDED) await dst.query(`delete from ${t}`);

    console.log('[import] restoring into the target…');
    // ON_ERROR_STOP: a partial import that reports success is worse than a
    // failure, because nobody goes looking for the missing half.
    run('psql', [TARGET, '--set', 'ON_ERROR_STOP=1', '--single-transaction', '--file', dumpFile], {
      stdio: 'inherit',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log('[import] merging staff password hashes into profiles…');
  const passwords = await mergeStaffPasswords(src, dst);
  console.log(`         ${passwords.merged} hash(es) carried over.`);

  console.log('\n[import] verifying…\n');
  const after = await counts(dst, all);
  let bad = 0;
  for (const t of all) {
    const ok = (before[t] ?? 0) === (after[t] ?? 0);
    if (!ok) bad++;
    console.log(
      `  ${ok ? 'ok  ' : 'DIFF'} ${t.padEnd(width)} source ${String(before[t] ?? '-').padStart(6)} -> target ${String(after[t] ?? '-').padStart(6)}`,
    );
  }

  // The embeddings are the one thing a re-run cannot recover, so they get an
  // explicit check rather than being just another row count.
  const { rows: emb } = await dst.query(
    'select count(*)::int as n from public.face_templates where embedding is not null',
  );
  const { rows: srcEmb } = await src.query(
    'select count(*)::int as n from public.face_templates where embedding is not null',
  );
  const embOk = emb[0].n === srcEmb[0].n;
  if (!embOk) bad++;
  console.log(`\n  ${embOk ? 'ok  ' : 'DIFF'} face embeddings ${srcEmb[0].n} -> ${emb[0].n}`);

  // A staff account with no hash cannot sign in AT ALL — there is no
  // national-ID fallback for staff (see domain/identity/credentials.ts). Left
  // unchecked it would surface as "the admin cannot log in" after the cutover,
  // which is the worst possible moment to discover it.
  const pwOk = passwords.staffWithoutPassword === 0;
  if (!pwOk) bad++;
  console.log(
    `  ${pwOk ? 'ok  ' : 'DIFF'} staff passwords  ${passwords.merged} merged, ` +
      `${passwords.staffWithoutPassword} account(s) still without one`,
  );

  await Promise.all([src.end(), dst.end()]);

  if (bad) {
    console.error(`\n[import] ${bad} table(s) do not match. Do NOT cut over.`);
    process.exit(1);
  }
  console.log(
    '\n[import] every table matches.\n' +
      '         Next: node scripts/import-storage.mjs (the image files), then\n' +
      '         sign in as a real member and check in on a test roster day.',
  );
}

main().catch((err) => {
  console.error(`[import] failed: ${err.message}`);
  process.exit(1);
});
