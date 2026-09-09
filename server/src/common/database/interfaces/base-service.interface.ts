import type { SQL } from 'drizzle-orm';
import type { JwtClaims } from '../../../db/context.js';

export interface IBaseService<
  TEntity,
  TId,
  TCreate,
  TUpdate,
  TResponse = TEntity,
> {
  findById(claims: JwtClaims | null, id: TId): Promise<TResponse | null>;
  findMany(claims: JwtClaims | null, where?: SQL, limit?: number, offset?: number): Promise<TResponse[]>;
  create(claims: JwtClaims | null, data: TCreate): Promise<TResponse>;
  update(claims: JwtClaims | null, id: TId, data: TUpdate): Promise<TResponse | null>;
  delete(claims: JwtClaims | null, id: TId): Promise<boolean>;
  pagination(claims: JwtClaims | null, where: SQL | undefined, limit: number, offset: number): Promise<{ items: TResponse[]; total: number }>;
}

