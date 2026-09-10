// The database context — Drizzle over the shared pg pool, with the two access
// modes this system has.
//
//   asCaller(claims, fn)  the request's own identity. The session becomes
//                         `authenticated` (or `anon`), so the table and column
//                         GRANTS apply, and the verified JWT is published into
//                         request.jwt.claims.
//
//   asService(fn)         the connection user, which owns the tables and is
//                         therefore exempt from those grants.
//
// WHAT CHANGED, AND WHAT THIS IS FOR NOW
//
// asCaller used to be the whole security model: dropping to `authenticated`
// brought 54 RLS policies into play, exactly as PostgREST did. Those policies
// are gone — every rule they encoded is in src/domain/access with unit tests,
// and the end-to-end suite was run against a database with RLS disabled to
// prove the API stood on its own before they were dropped.
//
// So the role switch is no longer what decides which ROWS a request sees. It
// still decides which TABLES AND COLUMNS it can touch at all, which is coarse,
// cheap, and worth keeping: `authenticated` cannot read
// app_settings.master_password_hash, cannot see refresh_tokens, and cannot
// write to the audit log — whatever a route forgets.
//
// The claims GUC is no longer published: auth.uid() was its only reader and
// that function is gone with the `auth` schema. What asCaller still does is
// switch the role, which is what brings the grants to bear.
//
// Exporting a bare `db` would make it one careless import to run a query with
// none of that applied, so it is deliberately not exported.
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { pool } from './pool.js';
import * as schema from './schema/index.js';
const root = drizzle(pool, { schema, casing: 'snake_case' });
import { AsyncLocalStorage } from 'async_hooks';
export const dbContextStorage = new AsyncLocalStorage();
/**
 * Run `fn` as the caller. `claims === null` means an unauthenticated request,
 * which runs as `anon` — enough for the few things granted to it and nothing
 * else. A route that must answer without a session decides that itself; see
 * GET /settings, which returns null rather than letting the grant refuse it.
 *
 * `set_config(..., is_local => true)` is load-bearing and must not be
 * "simplified": a plain SET would outlive the transaction and leak one user's
 * role onto the next request that borrows the same pooled connection —
 * privilege escalation, not a style choice.
 */
export async function asCaller(claims, fn) {
    const current = dbContextStorage.getStore();
    if (current) {
        await current.execute(sql `select set_config('role', ${claims ? 'authenticated' : 'anon'}, true)`);
        return fn(current);
    }
    return root.transaction(async (tx) => {
        // Drop privileges for the rest of the transaction. `is_local => true`
        // unwinds it at COMMIT or ROLLBACK; a plain SET would outlive the
        // transaction and leak this role onto the next request that borrows the
        // same pooled connection.
        await tx.execute(sql `select set_config('role', ${claims ? 'authenticated' : 'anon'}, true)`);
        return dbContextStorage.run(tx, () => fn(tx));
    });
}
/**
 * Run `fn` as the table owner — for the writes a client may never make
 * (`attendance` above all) and for the tables `authenticated` has no grant on.
 *
 * Authorization is entirely YOURS here. There is no second layer behind this
 * any more: check the caller first, with the helpers in services/accessService.
 *
 * The claims GUC is cleared so a stale `auth.uid()` from an earlier transaction
 * on the same pooled connection can never reach a SECURITY DEFINER function.
 */
export async function asService(fn) {
    const current = dbContextStorage.getStore();
    if (current) {
        await current.execute(sql `select set_config('request.jwt.claims', '', true)`);
        return fn(current);
    }
    return root.transaction(async (tx) => {
        await tx.execute(sql `select set_config('request.jwt.claims', '', true)`);
        return dbContextStorage.run(tx, () => fn(tx));
    });
}
/**
 * Run a statement and get the rows.
 *
 * Drizzle's own `execute` constrains its row type to `Record<string, unknown>`,
 * which the domain shapes deliberately are not — they are closed interfaces, so
 * a typo in a column alias is a compile error rather than `undefined` at
 * runtime. The cast is confined here rather than repeated at 129 call sites.
 */
export async function query(db, statement) {
    const result = await db.execute(statement);
    return result.rows;
}
/**
 * Call one of the schema's SQL functions the way `supabase.rpc()` used to.
 * The 36 functions are unchanged, so this stays a direct swap:
 *   supabase.rpc('server_now')  ->  callFunction(db, 'server_now')
 */
export async function callFunction(db, name, args = []) {
    const rows = await query(db, sql `select ${sql.identifier(safeName(name))}(${joinArgs(args)}) as result`);
    return rows[0].result;
}
/** Same, for the functions declared `returns table (...)`. */
export async function callTableFunction(db, name, args = []) {
    return query(db, sql `select * from ${sql.identifier(safeName(name))}(${joinArgs(args)})`);
}
function safeName(name) {
    if (!/^[a-z_][a-z0-9_]*$/.test(name))
        throw new Error(`unsafe function name: ${name}`);
    return name;
}
/**
 * Bind a JS array as ONE parameter, for `= any(...)`.
 *
 * Interpolating an array directly expands it into separate parameters —
 * `= any(($1, $2)::uuid[])` — which is a row constructor, not an array, and
 * fails with `malformed array literal`. `sql.param` keeps it whole:
 * `= any($1::uuid[])`.
 *
 * Kysely bound arrays the other way round, so every `any()` in this codebase
 * had to be revisited when it moved. Use this rather than remembering.
 */
export function arrayOf(values) {
    return sql.param(values);
}
/**
 * A `public.<name>` identifier, quoted.
 *
 * Table and column names reach SQL in identifier position, where they cannot be
 * bound as parameters — so anything dynamic goes through here and is quoted by
 * the driver rather than concatenated.
 */
export function qualified(name) {
    return sql `${sql.identifier(name)}`;
}
/** Every argument is bound, never interpolated. */
function joinArgs(args) {
    return args.length ? sql.join(args.map((a) => sql `${a}`), sql `, `) : sql.empty();
}
//# sourceMappingURL=context.js.map