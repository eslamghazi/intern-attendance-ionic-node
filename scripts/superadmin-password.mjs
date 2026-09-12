// Set a superadmin's password, or generate a strong one.
//
//   node scripts/superadmin-password.mjs                     the only superadmin, new random password
//   node scripts/superadmin-password.mjs 30110281500753      that one, new random password
//   node scripts/superadmin-password.mjs --set 'my password' set it explicitly
//
// WHY THIS EXISTS ALONGSIDE THE AUTOMATIC SEED
//
// The first superadmin is created at start-up with a generated password, shown
// once on the console and written to first-superadmin.txt. That is enough on a
// machine whose boot log you are watching — and no use at all on a panel that
// shows the last twenty lines, or a month later when the file is gone. This is
// the way back: it does not need the old password, because it is run by
// somebody who already has the database.
//
// EXISTING SESSIONS ARE ENDED. A password change that leaves old refresh tokens
// working is not a password change; anybody already signed in stays signed in.
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import 'dotenv/config';

// Must match BCRYPT_COST in src/config/constants.ts — a hash written at another
// cost still verifies, but the two should not drift without somebody deciding.
const BCRYPT_COST = 10;

const argv = process.argv.slice(2);
const setAt = argv.indexOf('--set');
const explicit = setAt === -1 ? null : argv[setAt + 1];
const nationalId = argv.find((a, i) => !a.startsWith('--') && i !== setAt + 1) ?? null;

if (setAt !== -1 && !explicit) {
  console.error('[superadmin-password] --set needs a password after it');
  process.exit(1);
}
if (explicit && explicit.length < 8) {
  console.error('[superadmin-password] a password given with --set must be at least 8 characters');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('[superadmin-password] DATABASE_URL is not set');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();

  const { rows } = nationalId
    ? await client.query(
        "select id, national_id, full_name from public.profiles where national_id = $1 and role = 'superadmin'",
        [nationalId],
      )
    : await client.query(
        "select id, national_id, full_name from public.profiles where role = 'superadmin' order by created_at",
      );

  if (!rows.length) {
    console.error(
      nationalId
        ? `[superadmin-password] no superadmin with national id ${nationalId}`
        : '[superadmin-password] this database has no superadmin.\n' +
          '                      Start the API against it and one is created automatically.',
    );
    process.exit(1);
  }
  if (rows.length > 1) {
    console.error('[superadmin-password] more than one superadmin — name the one you mean:');
    for (const r of rows) console.error(`    ${r.national_id}  ${r.full_name}`);
    process.exit(1);
  }

  const target = rows[0];
  // base64url so it survives a shell, a URL and a copy-paste without escaping.
  const password = explicit || randomBytes(24).toString('base64url');

  await client.query('begin');
  await client.query('update public.profiles set password_hash = $2 where id = $1', [
    target.id,
    await bcrypt.hash(password, BCRYPT_COST),
  ]);
  const revoked = await client.query('delete from public.refresh_tokens where profile_id = $1', [
    target.id,
  ]);
  await client.query('commit');

  const rule = '='.repeat(72);
  console.log(
    [
      '',
      rule,
      '  SUPERADMIN PASSWORD SET',
      '',
      `    national id  ${target.national_id}`,
      `    password     ${password}`,
      '',
      `  ${revoked.rowCount} existing session(s) ended.`,
      rule,
      '',
    ].join('\n'),
  );
} catch (err) {
  await client.query('rollback').catch(() => {});
  console.error(`[superadmin-password] failed, nothing was changed: ${err.message}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
