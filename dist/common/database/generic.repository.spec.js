import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GenericRepository } from './generic.repository.js';
import { dbContextStorage } from './unit-of-work.service.js';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
const testTable = pgTable('test_entity', {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
});
class TestRepository extends GenericRepository {
    constructor() {
        super(testTable, testTable.id);
    }
}
describe('GenericRepository', () => {
    let repo;
    let mockDb;
    beforeEach(() => {
        repo = new TestRepository();
        mockDb = {
            select: vi.fn(),
            insert: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        };
    });
    it('throws error if called outside of UnitOfWork', async () => {
        vi.spyOn(dbContextStorage, 'getStore').mockReturnValue(undefined);
        await expect(repo.findById('123')).rejects.toThrow('UnitOfWork');
    });
    it('findById returns entity when row exists', async () => {
        const mockRow = { id: '123', name: 'Test' };
        const mockQuery = {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([mockRow]),
        };
        mockDb.select.mockReturnValue(mockQuery);
        vi.spyOn(dbContextStorage, 'getStore').mockReturnValue(mockDb);
        const result = await repo.findById('123');
        expect(result).toEqual(mockRow);
        expect(mockDb.select).toHaveBeenCalled();
    });
    it('findById returns null when row does not exist', async () => {
        const mockQuery = {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockQuery);
        vi.spyOn(dbContextStorage, 'getStore').mockReturnValue(mockDb);
        const result = await repo.findById('non-existent');
        expect(result).toBeNull();
    });
    it('create inserts and returns entity', async () => {
        const created = { id: 'new-id', name: 'Created' };
        const mockInsert = {
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([created]),
        };
        mockDb.insert.mockReturnValue(mockInsert);
        vi.spyOn(dbContextStorage, 'getStore').mockReturnValue(mockDb);
        const result = await repo.create({ name: 'Created' });
        expect(result).toEqual(created);
    });
    it('update modifies entity and returns updated entity', async () => {
        const updated = { id: '123', name: 'Updated' };
        const mockUpdate = {
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([updated]),
        };
        mockDb.update.mockReturnValue(mockUpdate);
        vi.spyOn(dbContextStorage, 'getStore').mockReturnValue(mockDb);
        const result = await repo.update('123', { name: 'Updated' });
        expect(result).toEqual(updated);
    });
    it('delete removes entity and returns boolean', async () => {
        const mockDelete = {
            where: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([{ id: '123' }]),
        };
        mockDb.delete.mockReturnValue(mockDelete);
        vi.spyOn(dbContextStorage, 'getStore').mockReturnValue(mockDb);
        const result = await repo.delete('123');
        expect(result).toBe(true);
    });
    it('count returns numeric count', async () => {
        const mockQuery = {
            from: vi.fn().mockResolvedValue([{ count: '42' }]),
        };
        mockDb.select.mockReturnValue(mockQuery);
        vi.spyOn(dbContextStorage, 'getStore').mockReturnValue(mockDb);
        const count = await repo.count();
        expect(count).toBe(42);
    });
    it('exists returns true when count is positive', async () => {
        const mockQuery = {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ count: 1 }]),
        };
        mockDb.select.mockReturnValue(mockQuery);
        vi.spyOn(dbContextStorage, 'getStore').mockReturnValue(mockDb);
        const exists = await repo.exists(eq(testTable.id, '123'));
        expect(exists).toBe(true);
    });
});
//# sourceMappingURL=generic.repository.spec.js.map