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
import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from './pool.js';
import * as schema from './schema/index.js';
const root = drizzle(pool, { schema, casing: 'snake_case' });
import { AsyncLocalStorage } from 'async_hooks';
export const dbContextStorage = new AsyncLocalStorage();
/**
 * Run `fn` inside a transaction.
 *
 * Joins the one already open on this async context when there is one, so a
 * service calling another service does not take a second pooled connection and
 * deadlock against the first.
 */
export async function transaction(fn) {
    const current = dbContextStorage.getStore();
    if (current)
        return fn(current);
    return root.transaction(async (tx) => dbContextStorage.run(tx, () => fn(tx)));
}
//# sourceMappingURL=context.js.map