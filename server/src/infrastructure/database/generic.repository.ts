import { SQL, count, eq } from 'drizzle-orm';
import { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { BaseRepository } from './base.repository.js';
import type { IGenericRepository } from './interfaces/generic-repository.interface.js';
import type { ColumnPatch, Insert, Row } from './row.types.js';

/**
 * The CRUD every repository gets for free, typed from its table.
 *
 * ONE type argument, because the other three were never independent: a row, an
 * insert and a patch all follow from the table, and spelling them out by hand
 * meant thirteen chances to hand a repository one table and type it against
 * another. `GenericRepository<typeof members>` cannot make that mistake.
 *
 * WHY THE SEAM BELOW EXISTS
 *
 * Drizzle's query builders cannot be made generic over a table. `from()` is
 * declared as
 *
 *   from<TFrom extends PgTable | Subquery | PgViewBase | SQL>(
 *     source: TableLikeHasEmptySelection<TFrom> extends true ? DrizzleTypeError<…> : TFrom
 *   )
 *
 * and TypeScript cannot evaluate that conditional while `TFrom` is still a type
 * parameter, so it refuses the call — not because the table is wrong, but
 * because it cannot yet tell. `returning()` has the same shape and so does
 * `.set()`. There is no arrangement of constraints that resolves them; a naked
 * type parameter never narrows.
 *
 * So the table is erased exactly four times, in the four private helpers below,
 * and re-typed there. Everything this class exposes is derived from the table.
 * Previously the erasure was in all nine public methods and each one restated
 * the row type by hand — nine assertions, any of which could have named the
 * wrong type without the compiler noticing.
 */
export abstract class GenericRepository<TTable extends PgTable, TId = string>
  extends BaseRepository
  implements IGenericRepository<TTable, TId>
{
  constructor(
    protected readonly table: TTable,
    protected readonly primaryKeyColumn: PgColumn,
  ) {
    super();
  }

  // --- The seam ---------------------------------------------------------------
  //
  // The only four places the table is erased. Each returns the typed row so no
  // caller — inside this class or out — ever handles the erased form.

  private async selectRows(where?: SQL, limit?: number, offset?: number): Promise<Row<TTable>[]> {
    let query = this.db.select().from(this.table as PgTable).$dynamic();
    if (where) query = query.where(where);
    if (limit !== undefined) query = query.limit(limit);
    if (offset !== undefined) query = query.offset(offset);
    return (await query) as Row<TTable>[];
  }

  private async insertRow(data: Insert<TTable>): Promise<Row<TTable>[]> {
    const rows = await this.db
      .insert(this.table as PgTable)
      .values(data as PgTable['$inferInsert'])
      .returning();
    return rows as Row<TTable>[];
  }

  private async updateRows(where: SQL, data: ColumnPatch<TTable>): Promise<Row<TTable>[]> {
    const rows = await this.db
      .update(this.table as PgTable)
      .set(data as ColumnPatch<PgTable>)
      .where(where)
      .returning();
    return rows as Row<TTable>[];
  }

  private async deleteRows(where: SQL): Promise<{ id: unknown }[]> {
    return this.db
      .delete(this.table as PgTable)
      .where(where)
      .returning({ id: this.primaryKeyColumn });
  }

  // --- The CRUD ----------------------------------------------------------------

  /** The primary key equals this id. */
  private byId(id: TId): SQL {
    return eq(this.primaryKeyColumn, id);
  }

  async findById(id: TId): Promise<Row<TTable> | null> {
    const rows = await this.selectRows(this.byId(id), 1);
    return rows[0] ?? null;
  }

  async findOne(where: SQL): Promise<Row<TTable> | null> {
    const rows = await this.selectRows(where, 1);
    return rows[0] ?? null;
  }

  async findMany(where?: SQL, limit?: number, offset?: number): Promise<Row<TTable>[]> {
    return this.selectRows(where, limit, offset);
  }

  async create(data: Insert<TTable>): Promise<Row<TTable>> {
    const rows = await this.insertRow(data);
    // The insert returned nothing, which for a statement with RETURNING means
    // it never ran. Better a thrown error here than a row-shaped `undefined`
    // handed back as if it were the created record.
    const created = rows[0];
    if (!created) throw new Error('insert returned no row');
    return created;
  }

  async update(id: TId, data: ColumnPatch<TTable>): Promise<Row<TTable> | null> {
    const rows = await this.updateRows(this.byId(id), data);
    return rows[0] ?? null;
  }

  async delete(id: TId): Promise<boolean> {
    const rows = await this.deleteRows(this.byId(id));
    return rows.length > 0;
  }

  async exists(where: SQL): Promise<boolean> {
    // Selects the key rather than a constant: the question is whether a row
    // matches, and `limit(1)` already means nothing else is read.
    const rows = await this.db
      .select({ id: this.primaryKeyColumn })
      .from(this.table as PgTable)
      .where(where)
      .limit(1);
    return rows.length > 0;
  }

  async count(where?: SQL): Promise<number> {
    const query = this.db
      .select({ count: count() })
      .from(this.table as PgTable)
      .$dynamic();
    const rows = await (where ? query.where(where) : query);
    return Number(rows[0]?.count ?? 0);
  }

  async pagination(
    where: SQL | undefined,
    limit: number,
    offset: number,
  ): Promise<{ items: Row<TTable>[]; total: number }> {
    const [items, total] = await Promise.all([
      this.findMany(where, limit, offset),
      this.count(where),
    ]);
    return { items, total };
  }
}
