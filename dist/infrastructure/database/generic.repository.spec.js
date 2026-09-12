// The CRUD every repository inherits, over a stubbed driver.
//
// These check what the methods RETURN — a row, null, a boolean, a number — and
// nothing about the order Drizzle's builder methods are called in. The previous
// version hand-built a different mock chain per test (`from` returns this,
// `where` resolves), so it was really asserting the shape of the query builder:
// adding a `.limit(1)` to findById broke eight tests that had no opinion about
// limits. `chain()` below answers any builder call with itself and resolves to
// the rows it was given, which leaves the assertions about behaviour.
//
// What this deliberately does NOT cover is whether the SQL is right. That needs
// a database, and lives in generic.repository.int.spec.ts.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import { GenericRepository } from './generic.repository.js';
import { dbContextStorage } from './unit-of-work.service.js';
const testTable = pgTable('test_entity', {
    // defaultRandom() so an insert need not supply the key, like every real
    // table in the schema.
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
});
class TestRepository extends GenericRepository {
    constructor() {
        super(testTable, testTable.id);
    }
}
/**
 * A query builder that answers every call with itself and awaits to `rows`.
 *
 * Thenable rather than a promise, so it can be both chained and awaited — which
 * is exactly what Drizzle's builders are.
 */
function chain(rows) {
    const q = {};
    for (const method of [
        'from', '$dynamic', 'where', 'limit', 'offset', 'orderBy',
        'set', 'values', 'returning',
    ]) {
        q[method] = vi.fn(() => q);
    }
    q.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject);
    return q;
}
/** A stubbed transaction context that hands `rows` back to any query. */
function stubDb(rows) {
    const q = chain(rows);
    const db = {
        select: vi.fn(() => q),
        insert: vi.fn(() => q),
        update: vi.fn(() => q),
        delete: vi.fn(() => q),
    };
    vi.spyOn(dbContextStorage, 'getStore').mockReturnValue(db);
    return db;
}
describe('GenericRepository', () => {
    let repo;
    beforeEach(() => {
        vi.restoreAllMocks();
        repo = new TestRepository();
    });
    const row = { id: '123', name: 'Test' };
    it('refuses to run outside a UnitOfWork', async () => {
        vi.spyOn(dbContextStorage, 'getStore').mockReturnValue(undefined);
        await expect(repo.findById('123')).rejects.toThrow('UnitOfWork');
    });
    it('findById returns the row', async () => {
        const db = stubDb([row]);
        await expect(repo.findById('123')).resolves.toEqual(row);
        expect(db.select).toHaveBeenCalled();
    });
    it('findById returns null when nothing matched', async () => {
        stubDb([]);
        await expect(repo.findById('nobody')).resolves.toBeNull();
    });
    it('findOne returns null when nothing matched', async () => {
        stubDb([]);
        await expect(repo.findOne(eq(testTable.id, '123'))).resolves.toBeNull();
    });
    it('findMany returns every row', async () => {
        stubDb([row, { id: '456', name: 'Other' }]);
        await expect(repo.findMany()).resolves.toHaveLength(2);
    });
    it('create returns the inserted row', async () => {
        const created = { id: 'new-id', name: 'Created' };
        stubDb([created]);
        await expect(repo.create({ name: 'Created' })).resolves.toEqual(created);
    });
    it('create throws rather than returning undefined as a row', async () => {
        // RETURNING with no row back means the insert did not happen. Handing that
        // to a caller as if it were the created record is how `undefined.id` ends
        // up three call frames away from the cause.
        stubDb([]);
        await expect(repo.create({ name: 'x' })).rejects.toThrow('insert returned no row');
    });
    it('update returns the updated row', async () => {
        const updated = { id: '123', name: 'Updated' };
        stubDb([updated]);
        await expect(repo.update('123', { name: 'Updated' })).resolves.toEqual(updated);
    });
    it('update returns null when the id matched nothing', async () => {
        stubDb([]);
        await expect(repo.update('nobody', { name: 'x' })).resolves.toBeNull();
    });
    it('delete reports whether a row went', async () => {
        stubDb([{ id: '123' }]);
        await expect(repo.delete('123')).resolves.toBe(true);
        stubDb([]);
        await expect(repo.delete('nobody')).resolves.toBe(false);
    });
    it('count coerces the driver’s bigint string to a number', async () => {
        // Postgres count() is bigint, and node-postgres hands bigints back as
        // strings to avoid losing precision — so `rows[0].count` is '42', and
        // returning it unconverted makes every caller's arithmetic string
        // concatenation.
        stubDb([{ count: '42' }]);
        await expect(repo.count()).resolves.toBe(42);
    });
    it('count is 0 when the query returns nothing', async () => {
        stubDb([]);
        await expect(repo.count()).resolves.toBe(0);
    });
    it('exists is true when a row matched', async () => {
        stubDb([{ id: '123' }]);
        await expect(repo.exists(eq(testTable.id, '123'))).resolves.toBe(true);
        stubDb([]);
        await expect(repo.exists(eq(testTable.id, '123'))).resolves.toBe(false);
    });
    it('pagination returns the page and the total together', async () => {
        stubDb([row]);
        // The same stub answers both queries, so the total reads back off the row.
        const page = await repo.pagination(undefined, 10, 0);
        expect(page.items).toEqual([row]);
        expect(typeof page.total).toBe('number');
    });
});
//# sourceMappingURL=generic.repository.spec.js.map