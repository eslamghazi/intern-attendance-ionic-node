// Back up the superadmin accounts.
//
// WHAT THIS IS FOR
//
// The superadmin is the only account that can create other staff, so losing
// every one of them locks the institution out of its own system. A restore
// takes minutes; rebuilding from an empty database does not.
//
// WHAT IT CONTAINS, AND WHY THAT MATTERS
//
// The bcrypt hash of each password, so a restore brings the accounts back as
// they were rather than as new ones with new credentials. A hash is not a
// password, but it is offline-attackable: THIS FILE IS A SECRET. It is written
// 0600, and .gitignore already refuses it by name.
//
// It deliberately does NOT contain anything else — no members, no attendance,
// no settings. For those, back up the database (deploy/backup.sh). This is the
// small, targeted file you keep somewhere you can reach when the database is
// the thing that went wrong.
//
//   node scripts/superadmin-backup.mjs [path]
//
// Default path: superadmin-backup.json in the working directory.
import { chmodSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import 'dotenv/config';

const out = resolve(process.cwd(), process.argv[2] || 'superadmin-backup.json');

if (!process.env.DATABASE_URL) {
  console.error('[superadmin-backup] DATABASE_URL is not set');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();

  const { rows } = await client.query(
    `select id, role, full_name, national_id, phone, email, avatar_url,
            password_hash, permissions, is_active, created_at
       from public.profiles
      where role = 'superadmin'
      order by created_at`,
  );

  if (!rows.length) {
    console.error(
      '[superadmin-backup] there are no superadmin accounts to back up.\n' +
        '                   Start the API against this database and it will create one.',
    );
    process.exit(1);
  }

  const payload = {
    kind: 'intern-attendance/superadmin-backup',
    version: 1,
    taken_at: new Date().toISOString(),
    accounts: rows,
  };

  writeFileSync(out, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
  // `mode` above applies only when the file is created; an existing one keeps
  // whatever permissions it had.
  chmodSync(out, 0o600);

  console.log(`[superadmin-backup] ${rows.length} account(s) -> ${out}`);
  for (const r of rows) console.log(`    ${r.national_id}  ${r.full_name}`);
  console.log(
    '\n    This file contains password hashes. Keep it as you would keep a key,\n' +
      '    and off the machine it protects.',
  );
} catch (err) {
  console.error(`[superadmin-backup] failed: ${err.message}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
