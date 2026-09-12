// The shapes Drizzle hands back, named.
//
// Every repository in this codebase used to spell its own out:
//
//   GenericRepository<typeof members.$inferSelect, string,
//                     typeof members.$inferInsert,
//                     Partial<typeof members.$inferInsert>>
//
// — four type arguments, three of them mechanically derivable from the first.
// Written by hand thirteen times, they were also wrong thirteen times over: a
// repository could be handed one table and typed against another, and nothing
// would say so. Derived from the table, they cannot disagree with it.

import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

/** A row as it comes out of a table. */
export type Row<TTable extends PgTable> = TTable['$inferSelect'];

/** A row as it goes in — defaults and generated columns optional. */
export type Insert<TTable extends PgTable> = TTable['$inferInsert'];

/**
 * A partial update, keyed by the schema's TypeScript names.
 *
 * WHY THIS AND NOT `Record<string, unknown>`
 *
 * Drizzle's `.set()` keys are the table's TYPESCRIPT property names, not the
 * database's column names — `fullName`, not `full_name`. And it does not
 * complain about a key it does not recognise: it drops it and builds the
 * statement from whatever is left.
 *
 *   db.update(members).set({ group_id: 'g', is_active: true })
 *   -> update "members" set  where ...            // every key gone, invalid SQL
 *
 *   db.update(profiles).set({ full_name: 'x', phone: '01' })
 *   -> update "profiles" set "phone" = $1 ...     // the name silently ignored
 *
 * Typing a patch as `Record<string, unknown>` hands that mistake a clean bill of
 * health from the compiler, and the caller gets `{ ok: true }` for a write that
 * never happened. Typed as `ColumnPatch<typeof profiles>`, `full_name` is a
 * compile error, and the API's snake_case has to be translated on purpose.
 */
export type ColumnPatch<TTable extends PgTable> = Partial<Insert<TTable>>;

/**
 * A row from a VIEW, with the columns its SQL guarantees marked non-null.
 *
 * A view declaration carries no NOT NULL information — Drizzle has only the
 * column list to go on — so `member_directory` infers every column as nullable,
 * including `full_name`, which comes from an INNER JOIN onto a NOT NULL column
 * and cannot be null in any row the view can produce.
 *
 * Left alone, that forces a choice between two bad options: widen the row type
 * and push a `| null` that cannot happen all the way into the screens, or
 * `as unknown as DirectoryRow[]` and tell the compiler nothing at all.
 *
 * This is the third option, and the reason it is worth having: it can ONLY
 * remove nullability. `TColumns extends keyof TRow` means a column that is
 * renamed or dropped fails the build instead of being silently un-guaranteed,
 * and nothing here can invent a field, change a type or reorder anything. The
 * claim being made is exactly "these columns are never null", written where the
 * query that justifies it can be read beside it.
 */
export type Guaranteed<TRow, TColumns extends keyof TRow> = Omit<TRow, TColumns> & {
  [K in TColumns]-?: NonNullable<TRow[K]>;
};

/**
 * The row a `.select({ … })` produces, computed from the selection itself.
 *
 * Drizzle knows this type — but only inside the query expression, where it is
 * anonymous and cannot be named, exported or implemented. So a repository that
 * wants to promise a row shape has had to restate it by hand next to the query
 * that produces it, and the two drift: rename a column and the query changes
 * while the interface goes on claiming the old name, with an `as` between them
 * keeping the compiler quiet.
 *
 * Given the selection map as a value, this derives the row from the columns
 * themselves — including nullability, which Drizzle records per column. The map
 * and the type then cannot disagree, because there is only one of them.
 *
 *   const COLUMNS = { full_name: memberDirectory.fullName } as const;
 *   type DirectoryRow = SelectedRow<typeof COLUMNS>;   // { full_name: string | null }
 */
export type SelectedRow<TSelection extends Record<string, PgColumn>> = {
  [K in keyof TSelection]: TSelection[K]['_']['notNull'] extends true
    ? TSelection[K]['_']['data']
    : TSelection[K]['_']['data'] | null;
};
