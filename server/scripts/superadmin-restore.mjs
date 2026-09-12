// Restore superadmin accounts from a backup.
//
//   node scripts/superadmin-restore.mjs [path] [--force]
//
// Default path: superadmin-backup.json in the working directory.
//
// MATCHED BY NATIONAL ID, NOT BY ID
//
// A restore usually lands in a database that is not the one the backup came
// from — a rebuild, a migration to another server — where the old uuids belong
// to nobody. The national id is the thing that identifies a person across both,
// so that is what is matched on, and a fresh uuid is issued when inserting.
//
// AN EXISTING ACCOUNT IS NOT OVERWRITTEN WITHOUT --force
//
// Restoring on top of a working account replaces its password with the one from
// the backup, which is a way to lock somebody out by accident. Without --force
// those rows are reported and skipped, so the common case — "we lost the
// accounts, put them back" — needs no flag and the dangerous case needs a word.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import 'dotenv/config';

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const file = resolve(process.cwd(), argv.find((a) => !a.startsWith('--')) || 'superadmin-backup.json');

if (!process.env.DATABASE_URL) {
  console.error('[superadmin-restore] DATABASE_URL is not set');
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`[superadmin-restore] could not read ${file}: ${err.message}`);
  process.exit(1);
}

if (payload?.kind !== 'intern-attendance/superadmin-backup' || !Array.isArray(payload.accounts)) {
  console.error(
    `[superadmin-restore] ${file} is not a superadmin backup ` +
      '(expected kind "intern-attendance/superadmin-backup")',
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});

let restored = 0;
let skipped = 0;
let replaced = 0;

try {
  await client.connect();
  // All or nothing: a half-restored set of superadmins is worse than none,
  // because it looks like it worked.
  await client.query('begin');

  for (const a of payload.accounts) {
    if (!a?.national_id || !a?.password_hash) {
      console.error(`    SKIP  an account in the backup has no national_id or password_hash`);
      skipped++;
      continue;
    }

    const { rows: existing } = await client.query(
      'select id, role from public.profiles where national_id = $1',
      [a.national_id],
    );

    if (existing[0] && !force) {
      console.log(`    skip  ${a.national_id}  (already exists — use --force to overwrite)`);
      skipped++;
      continue;
    }

    if (existing[0]) {
      await client.query(
        `update public.profiles
            set role = 'superadmin', full_name = $2, phone = $3, email = $4,
                avatar_url = $5, password_hash = $6, permissions = $7, is_active = $8
          where id = $1`,
        [
          existing[0].id,
          a.full_name,
          a.phone ?? null,
          a.email ?? null,
          a.avatar_url ?? null,
          a.password_hash,
          a.permissions ?? null,
          a.is_active ?? true,
        ],
      );
      console.log(`    over  ${a.national_id}  ${a.full_name}`);
      replaced++;
      continue;
    }

    // A NEW uuid, not the one from the backup: the old one may already belong
    // to somebody in this database, and nothing references a superadmin by id
    // that a restore needs to preserve.
    await client.query(
      `insert into public.profiles
         (role, full_name, national_id, phone, email, avatar_url, password_hash,
          permissions, is_active)
       values ('superadmin', $1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        a.full_name,
        a.national_id,
        a.phone ?? null,
        a.email ?? null,
        a.avatar_url ?? null,
        a.password_hash,
        a.permissions ?? null,
        a.is_active ?? true,
      ],
    );
    console.log(`    add   ${a.national_id}  ${a.full_name}`);
    restored++;
  }

  await client.query('commit');
  console.log(
    `\n[superadmin-restore] ${restored} added, ${replaced} overwritten, ${skipped} skipped.`,
  );
  if (restored || replaced) {
    console.log('    Passwords are the ones from the backup, not new ones.');
  }
} catch (err) {
  await client.query('rollback').catch(() => {});
  console.error(`[superadmin-restore] failed, nothing was changed: ${err.message}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
