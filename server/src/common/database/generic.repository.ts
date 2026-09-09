import { SQL, eq, sql } from 'drizzle-orm';
import { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { BaseRepository } from './base.repository.js';

export abstract class GenericRepository<
  TEntity,
  TId,
  TCreate,
  TUpdate
> extends BaseRepository {
  constructor(
    protected readonly table: PgTable,
    protected readonly primaryKeyColumn: PgColumn
  ) {
    super();
  }

  async findById(id: TId): Promise<TEntity | null> {
    const rows = await this.db.select().from(this.table as any).where(eq(this.primaryKeyColumn as any, id as any));
    return (rows[0] as unknown as TEntity) ?? null;
  }

  async findOne(where: SQL): Promise<TEntity | null> {
    const rows = await this.db.select().from(this.table as any).where(where).limit(1);
    return (rows[0] as unknown as TEntity) ?? null;
  }

  async findMany(where?: SQL, limit?: number, offset?: number): Promise<TEntity[]> {
    let query: any = this.db.select().from(this.table as any);
    if (where) query = query.where(where);
    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);
    return (await query) as unknown as TEntity[];
  }

  async create(data: TCreate): Promise<TEntity> {
    const rows = await this.db.insert(this.table as any).values(data as any).returning();
    return (rows as any)[0] as unknown as TEntity;
  }

  async update(id: TId, data: TUpdate): Promise<TEntity | null> {
    const rows = await this.db
      .update(this.table as any)
      .set(data as any)
      .where(eq(this.primaryKeyColumn as any, id as any))
      .returning();
    return (rows as any)[0] as unknown as TEntity ?? null;
  }

  async delete(id: TId): Promise<boolean> {
    const rows = await this.db
      .delete(this.table as any)
      .where(eq(this.primaryKeyColumn as any, id as any))
      .returning({ id: this.primaryKeyColumn });
    return (rows as any).length > 0;
  }

  async exists(where: SQL): Promise<boolean> {
    const rows = await this.db.select({ count: sql<number>`1` }).from(this.table as any).where(where).limit(1);
    return rows.length > 0;
  }

  async count(where?: SQL): Promise<number> {
    let query: any = this.db.select({ count: sql<number>`count(*)` }).from(this.table as any);
    if (where) query = query.where(where);
    const rows = await query;
    return Number(rows[0]?.count || 0);
  }

  async pagination(where: SQL | undefined, limit: number, offset: number): Promise<{ items: TEntity[]; total: number }> {
    const [items, total] = await Promise.all([
      this.findMany(where, limit, offset),
      this.count(where),
    ]);
    return { items, total };
  }
}
