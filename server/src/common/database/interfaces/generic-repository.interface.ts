import type { SQL } from 'drizzle-orm';

export interface IGenericRepository<
  TEntity,
  TId,
  TCreate,
  TUpdate,
> {
  findById(id: TId): Promise<TEntity | null>;
  findOne(where: SQL): Promise<TEntity | null>;
  findMany(where?: SQL, limit?: number, offset?: number): Promise<TEntity[]>;
  create(data: TCreate): Promise<TEntity>;
  update(id: TId, data: TUpdate): Promise<TEntity | null>;
  delete(id: TId): Promise<boolean>;
  exists(where: SQL): Promise<boolean>;
  count(where?: SQL): Promise<number>;
  pagination(where: SQL | undefined, limit: number, offset: number): Promise<{ items: TEntity[]; total: number }>;
}
