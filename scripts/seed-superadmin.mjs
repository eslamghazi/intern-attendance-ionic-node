// Ensure the default superadmin exists.
//
// This used to run as the frontend's `prebuild`, which meant every web build
// needed the service-role key in its environment and could silently create
// accounts. It belongs here, next to the database it writes to, and is run
// deliberately — once, after migrating.
//
// Idempotent: it CREATES the account when missing and never clobbers an
// existing one's password.
//
//   SUPERADMIN_NATIONAL_ID=29001011234567 SUPERADMIN_NAME='Super Admin' \
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
  // GoTrue's bcrypt cost, so a hash written here is indistinguishable from one
  // it wrote before the migration. Matches BCRYPT_COST in authService.
  const hash = await bcrypt.hash(password, 10);

  // One row. This used to be two — an auth.users row for the password and a
  // profiles row for everything else — which is why it needed a transaction.
  await client.query(
    `insert into public.profiles (id, role, full_name, national_id, password_hash,
                                  must_change_password)
     values ($1, 'superadmin', $2, $3, $4, false)`,
    [id, name, nid, hash],
  );

  console.log(`[seed] superadmin created: ${name} (${nid})`);
} catch (err) {
  console.error(`[seed] failed: ${err.message}`);
  process.exit(1);
} finally {
  await client.end();
}
