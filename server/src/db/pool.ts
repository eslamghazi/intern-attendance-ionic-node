// The single Postgres pool for the whole API.
//
// The connection user is the schema OWNER, and an owner is exempt from the
// table and column grants. Request-scoped queries drop into
// `anon`/`authenticated` inside their transaction (see context.ts), so those
// grants apply to them — which is what keeps master_password_hash,
// refresh_tokens and the audit log out of reach of a signed-in caller.
import pg from 'pg';
import { env } from '../env.js';

// `numeric` arrives as a string by default so precision is never silently
// lost. Nothing in this schema stores money; the values that do come back
// numeric (distances, face scores) are read as numbers by the client, so
// parse them here rather than in every route.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
// `date` (not timestamptz) must stay a plain 'YYYY-MM-DD' string. Letting node
// build a Date would re-interpret it in the server's local zone and shift
// attendance rows across the midnight boundary — a member marked absent.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // A request that switched role must never hand a dirty session to the next
  // one. `set_config(..., is_local => true)` already unwinds at COMMIT, but a
  // hard cap on connection lifetime bounds the blast radius of any future
  // non-local SET that slips in.
  maxLifetimeSeconds: 3600,
});

pool.on('error', (err) => {
  // An idle client dying is recoverable — pg replaces it. Log, never exit.
  console.error('[db] idle client error', err);
});

export async function closeDb(): Promise<void> {
  await pool.end();
}
