/**
 * Every service's CRUD, wrapped in a transaction and mapped to a DTO.
 *
 * `BaseService<typeof members, MemberDto>` — the table and what the API answers
 * with. The row, the insert and the patch come from the table, so a service and
 * the repository under it cannot be typed against different tables.
 */
export class BaseService {
    uow;
    repo;
    constructor(uow, repo) {
        this.uow = uow;
        this.repo = repo;
    }
    async findById(id) {
        return this.uow.transaction(async () => {
            const entity = await this.repo.findById(id);
            return entity ? this.mapToResponse(entity) : null;
        });
    }
    async findOne(where) {
        return this.uow.transaction(async () => {
            const entity = await this.repo.findOne(where);
            return entity ? this.mapToResponse(entity) : null;
        });
    }
    async findMany(where, limit, offset) {
        return this.uow.transaction(async () => {
            const entities = await this.repo.findMany(where, limit, offset);
            return entities.map((e) => this.mapToResponse(e));
        });
    }
    async create(data) {
        return this.uow.transaction(async () => {
            const entity = await this.repo.create(data);
            return this.mapToResponse(entity);
        });
    }
    async update(id, data) {
        return this.uow.transaction(async () => {
            const entity = await this.repo.update(id, data);
            return entity ? this.mapToResponse(entity) : null;
        });
    }
    async delete(id) {
        return this.uow.transaction(async () => {
            return this.repo.delete(id);
        });
    }
    async exists(where) {
        return this.uow.transaction(async () => {
            return this.repo.exists(where);
        });
    }
    async count(where) {
        return this.uow.transaction(async () => {
            return this.repo.count(where);
        });
    }
    async pagination(where, limit, offset) {
        return this.uow.transaction(async () => {
            const result = await this.repo.pagination(where, limit, offset);
            return {
                items: result.items.map((e) => this.mapToResponse(e)),
                total: result.total,
            };
        });
    }
}
//# sourceMappingURL=base.service.js.map