import { UnitOfWorkService } from './unit-of-work.service.js';
import { GenericRepository } from './generic.repository.js';
import type { SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { ColumnPatch, Insert, Row } from './row.types.js';
import type { IBaseService } from './interfaces/base-service.interface.js';

/**
 * Every service's CRUD, wrapped in a transaction and mapped to a DTO.
 *
 * `BaseService<typeof members, MemberDto>` — the table and what the API answers
 * with. The row, the insert and the patch come from the table, so a service and
 * the repository under it cannot be typed against different tables.
 */
export abstract class BaseService<TTable extends PgTable, TResponse, TId = string>
  implements IBaseService<TTable, TResponse, TId>
{
  constructor(
    protected readonly uow: UnitOfWorkService,
    protected readonly repo: GenericRepository<TTable, TId>,
  ) {}

  protected abstract mapToResponse(entity: Row<TTable>): TResponse;

  async findById(id: TId): Promise<TResponse | null> {
    return this.uow.transaction(async () => {
      const entity = await this.repo.findById(id);
      return entity ? this.mapToResponse(entity) : null;
    });
  }

  async findOne(where: SQL): Promise<TResponse | null> {
    return this.uow.transaction(async () => {
      const entity = await this.repo.findOne(where);
      return entity ? this.mapToResponse(entity) : null;
    });
  }

  async findMany(where?: SQL, limit?: number, offset?: number): Promise<TResponse[]> {
    return this.uow.transaction(async () => {
      const entities = await this.repo.findMany(where, limit, offset);
      return entities.map((e) => this.mapToResponse(e));
    });
  }

  async create(data: Insert<TTable>): Promise<TResponse> {
    return this.uow.transaction(async () => {
      const entity = await this.repo.create(data);
      return this.mapToResponse(entity);
    });
  }

  async update(id: TId, data: ColumnPatch<TTable>): Promise<TResponse | null> {
    return this.uow.transaction(async () => {
      const entity = await this.repo.update(id, data);
      return entity ? this.mapToResponse(entity) : null;
    });
  }

  async delete(id: TId): Promise<boolean> {
    return this.uow.transaction(async () => {
      return this.repo.delete(id);
    });
  }

  async exists(where: SQL): Promise<boolean> {
    return this.uow.transaction(async () => {
      return this.repo.exists(where);
    });
  }

  async count(where?: SQL): Promise<number> {
    return this.uow.transaction(async () => {
      return this.repo.count(where);
    });
  }

  async pagination(where: SQL | undefined,
    limit: number,
    offset: number
  ): Promise<{ items: TResponse[]; total: number }> {
    return this.uow.transaction(async () => {
      const result = await this.repo.pagination(where, limit, offset);
      return {
        items: result.items.map((e) => this.mapToResponse(e)),
        total: result.total,
      };
    });
  }
}
