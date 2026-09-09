import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BaseService } from './base.service.js';
import { UnitOfWorkService } from './unit-of-work.service.js';
import { GenericRepository } from './generic.repository.js';
import type { JwtClaims } from '../../db/context.js';
import { sql } from 'drizzle-orm';

interface TestEntity {
  id: string;
  name: string;
}

interface TestResponse {
  id: string;
  name: string;
  mapped: boolean;
}

class ConcreteService extends BaseService<TestEntity, string, { name: string }, { name: string }, TestResponse> {
  protected mapToResponse(entity: TestEntity): TestResponse {
    return {
      id: entity.id,
      name: entity.name,
      mapped: true,
    };
  }
}

describe('BaseService', () => {
  let service: ConcreteService;
  let mockUow: UnitOfWorkService;
  let mockRepo: any;
  const mockClaims: JwtClaims = {
    sub: 'user-1',
    aud: 'authenticated',
    role: 'authenticated',
    user_role: 'admin',
  };

  beforeEach(() => {
    mockUow = {
      asCaller: vi.fn((claims, work) => work()),
      asService: vi.fn((work) => work()),
    } as any;

    mockRepo = {
      findById: vi.fn(),
      findOne: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      count: vi.fn(),
      pagination: vi.fn(),
    };

    service = new ConcreteService(mockUow, mockRepo);
  });

  it('findById calls repo and maps entity', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'Alpha' });
    const res = await service.findById(mockClaims, '1');

    expect(mockUow.asCaller).toHaveBeenCalledWith(mockClaims, expect.any(Function));
    expect(mockRepo.findById).toHaveBeenCalledWith('1');
    expect(res).toEqual({ id: '1', name: 'Alpha', mapped: true });
  });

  it('findById returns null if not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    const res = await service.findById(mockClaims, '2');
    expect(res).toBeNull();
  });

  it('create calls repo and maps returned entity', async () => {
    mockRepo.create.mockResolvedValue({ id: '3', name: 'Beta' });
    const res = await service.create(mockClaims, { name: 'Beta' });

    expect(mockRepo.create).toHaveBeenCalledWith({ name: 'Beta' });
    expect(res).toEqual({ id: '3', name: 'Beta', mapped: true });
  });

  it('update calls repo and maps updated entity', async () => {
    mockRepo.update.mockResolvedValue({ id: '1', name: 'Gamma' });
    const res = await service.update(mockClaims, '1', { name: 'Gamma' });

    expect(mockRepo.update).toHaveBeenCalledWith('1', { name: 'Gamma' });
    expect(res).toEqual({ id: '1', name: 'Gamma', mapped: true });
  });

  it('delete calls repo and returns boolean', async () => {
    mockRepo.delete.mockResolvedValue(true);
    const res = await service.delete(mockClaims, '1');

    expect(mockRepo.delete).toHaveBeenCalledWith('1');
    expect(res).toBe(true);
  });

  it('pagination calls repo and maps item list with total', async () => {
    mockRepo.pagination.mockResolvedValue({
      items: [{ id: '1', name: 'Alpha' }, { id: '2', name: 'Beta' }],
      total: 2,
    });

    const res = await service.pagination(mockClaims, undefined, 10, 0);
    expect(res.total).toBe(2);
    expect(res.items).toEqual([
      { id: '1', name: 'Alpha', mapped: true },
      { id: '2', name: 'Beta', mapped: true },
    ]);
  });
});
