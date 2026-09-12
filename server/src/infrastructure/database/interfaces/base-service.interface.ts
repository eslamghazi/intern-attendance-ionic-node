import type { SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { ColumnPatch, Insert, Row } from '../row.types.js';

/**
 * The CRUD a service gets for free, in terms of the table beneath it and the
 * DTO it answers with.
 *
 * Two arguments where there were five, for the reason IGenericRepository has
 * one where it had four: the row, the insert and the patch are the table's to
 * decide, not the author's to restate.
 */
export interface IBaseService<TTable extends PgTable, TResponse, TId = string> {
  findById(id: TId): Promise<TResponse | null>;
  findMany(where?: SQL, limit?: number, offset?: number): Promise<TResponse[]>;
  create(data: Insert<TTable>): Promise<TResponse>;
  update(id: TId, data: ColumnPatch<TTable>): Promise<TResponse | null>;
  delete(id: TId): Promise<boolean>;
  pagination(
    where: SQL | undefined,
    limit: number,
    offset: number,
  ): Promise<{ items: TResponse[]; total: number }>;
}

