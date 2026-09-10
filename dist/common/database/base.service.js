export class BaseService {
    uow;
    repo;
    constructor(uow, repo) {
        this.uow = uow;
        this.repo = repo;
    }
    async findById(claims, id) {
        return this.uow.asCaller(claims, async () => {
            const entity = await this.repo.findById(id);
            return entity ? this.mapToResponse(entity) : null;
        });
    }
    async findOne(claims, where) {
        return this.uow.asCaller(claims, async () => {
            const entity = await this.repo.findOne(where);
            return entity ? this.mapToResponse(entity) : null;
        });
    }
    async findMany(claims, where, limit, offset) {
        return this.uow.asCaller(claims, async () => {
            const entities = await this.repo.findMany(where, limit, offset);
            return entities.map((e) => this.mapToResponse(e));
        });
    }
    async create(claims, data) {
        return this.uow.asCaller(claims, async () => {
            const entity = await this.repo.create(data);
            return this.mapToResponse(entity);
        });
    }
    async update(claims, id, data) {
        return this.uow.asCaller(claims, async () => {
            const entity = await this.repo.update(id, data);
            return entity ? this.mapToResponse(entity) : null;
        });
    }
    async delete(claims, id) {
        return this.uow.asCaller(claims, async () => {
            return this.repo.delete(id);
        });
    }
    async exists(claims, where) {
        return this.uow.asCaller(claims, async () => {
            return this.repo.exists(where);
        });
    }
    async count(claims, where) {
        return this.uow.asCaller(claims, async () => {
            return this.repo.count(where);
        });
    }
    async pagination(claims, where, limit, offset) {
        return this.uow.asCaller(claims, async () => {
            const result = await this.repo.pagination(where, limit, offset);
            return {
                items: result.items.map((e) => this.mapToResponse(e)),
                total: result.total,
            };
        });
    }
}
//# sourceMappingURL=base.service.js.map