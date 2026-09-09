import { UnitOfWorkService } from './unit-of-work.service.js';
import { GenericRepository } from './generic.repository.js';
import type { JwtClaims } from '../../db/context.js';
import type { SQL } from 'drizzle-orm';
import type { IBaseService } from './interfaces/base-service.interface.js';

export abstract class BaseService<
  TEntity,
  TId,
  TCreate,
  TUpdate,
  TResponse
> implements IBaseService<TEntity, TId, TCreate, TUpdate, TResponse> {

  constructor(
    protected readonly uow: UnitOfWorkService,
    protected readonly repo: GenericRepository<TEntity, TId, TCreate, TUpdate>
  ) {}

  protected abstract mapToResponse(entity: TEntity): TResponse;

  async findById(claims: JwtClaims | null, id: TId): Promise<TResponse | null> {
    return this.uow.asCaller(claims, async () => {
      const entity = await this.repo.findById(id);
      return entity ? this.mapToResponse(entity) : null;
    });
  }

  async findOne(claims: JwtClaims | null, where: SQL): Promise<TResponse | null> {
    return this.uow.asCaller(claims, async () => {
      const entity = await this.repo.findOne(where);
      return entity ? this.mapToResponse(entity) : null;
    });
  }

  async findMany(claims: JwtClaims | null, where?: SQL, limit?: number, offset?: number): Promise<TResponse[]> {
    return this.uow.asCaller(claims, async () => {
      const entities = await this.repo.findMany(where, limit, offset);
      return entities.map((e) => this.mapToResponse(e));
    });
  }

  async create(claims: JwtClaims | null, data: TCreate): Promise<TResponse> {
    return this.uow.asCaller(claims, async () => {
      const entity = await this.repo.create(data);
      return this.mapToResponse(entity);
    });
  }

  async update(claims: JwtClaims | null, id: TId, data: TUpdate): Promise<TResponse | null> {
    return this.uow.asCaller(claims, async () => {
      const entity = await this.repo.update(id, data);
      return entity ? this.mapToResponse(entity) : null;
    });
  }

  async delete(claims: JwtClaims | null, id: TId): Promise<boolean> {
    return this.uow.asCaller(claims, async () => {
      return this.repo.delete(id);
    });
  }

  async exists(claims: JwtClaims | null, where: SQL): Promise<boolean> {
    return this.uow.asCaller(claims, async () => {
      return this.repo.exists(where);
    });
  }

  async count(claims: JwtClaims | null, where?: SQL): Promise<number> {
    return this.uow.asCaller(claims, async () => {
      return this.repo.count(where);
    });
  }

  async pagination(
    claims: JwtClaims | null,
    where: SQL | undefined,
    limit: number,
    offset: number
  ): Promise<{ items: TResponse[]; total: number }> {
    return this.uow.asCaller(claims, async () => {
      const result = await this.repo.pagination(where, limit, offset);
      return {
        items: result.items.map((e) => this.mapToResponse(e)),
        total: result.total,
      };
    });
  }
}
