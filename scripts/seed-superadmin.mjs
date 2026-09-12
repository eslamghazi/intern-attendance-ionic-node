// Ensure the default superadmin exists.
//
// This used to run as the frontend's `prebuild`, which meant every web build
// needed privileged database credentials in its environment and could silently
// create accounts. It belongs here, next to the database it writes to, and is
// run deliberately — once, after migrating.
//
// Idempotent: it CREATES the account when missing and never clobbers an
// existing one's password.
//
//   SUPERADMIN_NATIONAL_ID=00000000000000 SUPERADMIN_NAME='Super Admin' \
//   SUPERADMIN_PASSWORD='…' node scripts/seed-superadmin.mjs
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import 'dotenv/config';

const nid = (process.env.SUPERADMIN_NATIONAL_ID ?? '').trim();
const name = (process.env.SUPERADMIN_NAME ?? 'Super Admin').trim();
const password = (process.env.SUPERADMIN_PASSWORD ?? '').trim();

if (!process.env.DATABASE_URL) {
  console.error('[seed] DATABASE_URL is not set');
  process.exit(1);
}
// THE SAME RULES THE SERVER APPLIES AT BOOT — see SuperadminSeedService. Two
// doors to one account, so they have to refuse the same things; the placeholder
// check is the one that matters, because .env.example ships
// CHANGE_ME_AT_LEAST_8_CHARS and an account with a password published in this
// repository is worse than no account at all.
if (/CHANGE_ME/i.test(password)) {
  console.error(
    '[seed] SUPERADMIN_PASSWORD is still the placeholder from .env.example — set a real one',
  );
  process.exit(1);
}
if (!/^\d{14}$/.test(nid) || password.length < 8) {
  console.error(
    '[seed] SUPERADMIN_NATIONAL_ID (14 digits) and SUPERADMIN_PASSWORD (8+ chars) are required',
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});
await client.connect();

try {
  const { rows: existing } = await client.query(
    'select id, role from public.profiles where national_id = $1',
    [nid],
  );
  if (existing[0]) {
    console.log(
      `[seed] a profile with that national id already exists (role: ${existing[0].role}) — leaving it alone.`,
    );
    process.exit(0);
  }

  const id = randomUUID();
  // Must match BCRYPT_COST in authService, or the account this writes cannot be
  // verified by the code that checks it.
  const hash = await bcrypt.hash(password, 10);

  // One row, so no transaction: an account is a profile and nothing else.
  await client.query(
    `insert into public.profiles (id, role, full_name, national_id, password_hash)
     values ($1, 'superadmin', $2, $3, $4)`,
    [id, name, nid, hash],
  );

  console.log(`[seed] superadmin created: ${name} (${nid})`);
} catch (err) {
  console.error(`[seed] failed: ${err.message}`);
  process.exit(1);
} finally {
  await client.end();
}
