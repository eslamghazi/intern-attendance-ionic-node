import type { SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { ColumnPatch, Insert, Row } from '../row.types.js';

/**
 * The CRUD contract, derived from the table it is about.
 *
 * ONE type argument where there were four. The other three — the row, the
 * insert, the patch — all follow from the table, and writing them out by hand
 * at every implementation meant they could disagree with it: a repository could
 * name `members` in its constructor and `profiles` in its type arguments and
 * compile clean. `IGenericRepository<typeof members>` cannot say two things.
 */
export interface IGenericRepository<TTable extends PgTable, TId = string> {
  findById(id: TId): Promise<Row<TTable> | null>;
  findOne(where: SQL): Promise<Row<TTable> | null>;
  findMany(where?: SQL, limit?: number, offset?: number): Promise<Row<TTable>[]>;
  create(data: Insert<TTable>): Promise<Row<TTable>>;
  update(id: TId, data: ColumnPatch<TTable>): Promise<Row<TTable> | null>;
  delete(id: TId): Promise<boolean>;
  exists(where: SQL): Promise<boolean>;
  count(where?: SQL): Promise<number>;
  pagination(
    where: SQL | undefined,
    limit: number,
    offset: number,
  ): Promise<{ items: Row<TTable>[]; total: number }>;
}
