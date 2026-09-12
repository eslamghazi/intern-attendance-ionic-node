// The single Postgres pool for the whole API.
//
// ONE connection user for every query, and it owns the schema. Requests never
// switch role, so the database draws no distinction between callers and applies
// no authorization of its own.
//
// That is a deliberate split, not an omission: every rule about who may read or
// write what is enforced BEFORE the query is built — by the guards in
// src/common/guards and the scope helpers in src/domain/access — where it is
// written in TypeScript, covered by tests that need no database, and visible on
// the route it protects. Authorization that lives in two places is
// authorization that disagrees with itself.
import pg from 'pg';
import { env } from '../../config/env.js';

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
  // A hard cap on connection lifetime, so that any session state a query
  // manages to leave behind cannot outlive the hour — and so a long-running
  // process eventually picks up a restarted database's new backends.
  maxLifetimeSeconds: 3600,
});

pool.on('error', (err) => {
  // An idle client dying is recoverable — pg replaces it. Log, never exit.
  console.error('[db] idle client error', err);
});

// The pool is closed on shutdown by PoolLifecycle (see pool.provider.ts), so
// that draining is sequenced with the rest of the application rather than racing
// it.
