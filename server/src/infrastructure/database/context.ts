// The database context: Drizzle over the shared pg pool, and one way to open a
// transaction.
//
//   transaction(fn)   run fn inside one. Nested calls join the transaction
//                     already open on this async context rather than opening a
//                     second on another pooled connection, which would deadlock
//                     against the first.
//
// ONE ENTRY POINT, ON PURPOSE
//
// Not a pair named for a privilege level. This API connects as a single database
// role for every request, so a second function could differ in name only — and a
// name implying a privilege boundary that does not exist is worse than no name
// at all, because callers start relying on it.
//
// AUTHORIZATION IS ENTIRELY ABOVE THIS LINE
//
// The database enforces nothing — it grants this one role full rights over the
// schema and asks no further questions. The guards in src/common/guards decide
// who is calling, and src/domain/access decides what they may reach. A query that gets here runs with the full rights of the schema
// owner, so the check must ALREADY have happened.
//
// That is a real trade. What it buys is one place to read the rules, written in
// the language everything else is written in, covered by tests that need no
// database. What it costs is that a missing check is not caught by a second
// layer — which is why routes.spec.ts fails the build for a route that does not
// declare who may call it.
//
// Exporting a bare `db` would make it one careless import to run a query
// outside a transaction, so it is deliberately not exported.
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql, type SQL } from 'drizzle-orm';
import { pool } from './pool.js';
import * as schema from './schema/index.js';
import { Role } from '../../common/enums/index.js';

export type Schema = typeof schema;

/** A handle inside an open transaction, with the caller's context applied. */
export type DbContext = Parameters<Parameters<NodePgDatabase<Schema>['transaction']>[0]>[0];

/**
 * The verified claim set of an access token. Nothing in the DATABASE reads it —
 * it is passed around the API as the answer to "who is asking".
 */
export interface JwtClaims {
  sub: string;
  aud: string;
  /**
   * The caller's role, re-read from `profiles` on every request by the auth
   * guard rather than trusted from the token.
   *
   * It used to drive current_app_role() and through it every row-level policy.
   * Nothing in the database reads it now — the API does, via req.caller.role —
   * but it stays in the claim set because the two must not disagree, and because
   * a token whose role is missing would be indistinguishable from one that never
   * had it.
   */
  user_role: Role;
  national_id?: string;
  iat?: number;
  exp?: number;
}

const root = drizzle(pool, { schema, casing: 'snake_case' });

import { AsyncLocalStorage } from 'async_hooks';

export const dbContextStorage = new AsyncLocalStorage<DbContext>();

/**
 * Run `fn` inside a transaction.
 *
 * Joins the one already open on this async context when there is one, so a
 * service calling another service does not take a second pooled connection and
 * deadlock against the first.
 */
export async function transaction<T>(fn: (db: DbContext) => Promise<T>): Promise<T> {
  const current = dbContextStorage.getStore();
  if (current) return fn(current);
  return root.transaction(async (tx) => dbContextStorage.run(tx, () => fn(tx)));
}

