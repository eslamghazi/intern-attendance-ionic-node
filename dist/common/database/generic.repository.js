import { eq, sql } from 'drizzle-orm';
import { BaseRepository } from './base.repository.js';
export class GenericRepository extends BaseRepository {
    table;
    primaryKeyColumn;
    constructor(table, primaryKeyColumn) {
        super();
        this.table = table;
        this.primaryKeyColumn = primaryKeyColumn;
    }
    async findById(id) {
        const rows = await this.db.select().from(this.table).where(eq(this.primaryKeyColumn, id));
        return rows[0] ?? null;
    }
    async findOne(where) {
        const rows = await this.db.select().from(this.table).where(where).limit(1);
        return rows[0] ?? null;
    }
    async findMany(where, limit, offset) {
        let query = this.db.select().from(this.table);
        if (where)
            query = query.where(where);
        if (limit)
            query = query.limit(limit);
        if (offset)
            query = query.offset(offset);
        return (await query);
    }
    async create(data) {
        const rows = await this.db.insert(this.table).values(data).returning();
        return rows[0];
    }
    async update(id, data) {
        const rows = await this.db
            .update(this.table)
            .set(data)
            .where(eq(this.primaryKeyColumn, id))
            .returning();
        return rows[0] ?? null;
    }
    async delete(id) {
        const rows = await this.db
            .delete(this.table)
            .where(eq(this.primaryKeyColumn, id))
            .returning({ id: this.primaryKeyColumn });
        return rows.length > 0;
    }
    async exists(where) {
        const rows = await this.db.select({ count: sql `1` }).from(this.table).where(where).limit(1);
        return rows.length > 0;
    }
    async count(where) {
        let query = this.db.select({ count: sql `count(*)` }).from(this.table);
        if (where)
            query = query.where(where);
        const rows = await query;
        return Number(rows[0]?.count || 0);
    }
    async pagination(where, limit, offset) {
        const [items, total] = await Promise.all([
            this.findMany(where, limit, offset),
            this.count(where),
        ]);
        return { items, total };
    }
}
//# sourceMappingURL=generic.repository.js.map