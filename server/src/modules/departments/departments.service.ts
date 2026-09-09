import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { DepartmentsRepository } from './departments.repository.js';
import type { Caller } from '../../domain/identity/role.js';
import type { JwtClaims } from '../../db/context.js';
import { notFound, forbidden } from '../../http/errors.js';

export interface PutDepartmentPayload {
  id?: string;
  name: string;
  branch_id: string | null;
}

export interface PutMemberDepartmentPayload {
  member_id: string;
  year: number;
  month: number;
  department_id: string | null;
}

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: DepartmentsRepository,
  ) {}

  async getDepartments(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getDepartments();
    });
  }

  async getDepartmentsOptions(claims: JwtClaims, branchId?: string) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getDepartmentsOptions(branchId);
    });
  }

  async putDepartment(caller: Caller, claims: JwtClaims, d: PutDepartmentPayload) {
    return this.uow.asCaller(claims, async () => {
      const { requireBranch, scopeOf } = await import('../../services/accessService.js');

      if (d.branch_id) {
        await requireBranch((this.repo as any).db, caller, d.branch_id);
      } else if ((await scopeOf((this.repo as any).db, caller)).kind !== 'all') {
        throw forbidden('a faculty-wide department is not yours to create');
      }

      return this.repo.upsertDepartment(d.id, d.name, d.branch_id);
    });
  }

  async deleteDepartment(caller: Caller, claims: JwtClaims, id: string) {
    return this.uow.asCaller(claims, async () => {
      const { requireBranch, scopeOf } = await import('../../services/accessService.js');

      const existing = await this.repo.getDepartmentBranchId(id);
      if (!existing) throw notFound();

      if (existing.branchId) {
        await requireBranch((this.repo as any).db, caller, existing.branchId);
      } else if ((await scopeOf((this.repo as any).db, caller)).kind !== 'all') {
        throw forbidden('a faculty-wide department is not yours to delete');
      }

      const deleted = await this.repo.deleteDepartment(id);
      if (!deleted) throw notFound();
    });
  }

  async getMemberDepartments(claims: JwtClaims, year: number, month: number) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getMemberDepartments(year, month);
    });
  }

  async putMemberDepartment(claims: JwtClaims, b: PutMemberDepartmentPayload) {
    return this.uow.asCaller(claims, async () => {
      if (!b.department_id) {
        await this.repo.deleteMemberDepartment(b.member_id, b.year, b.month);
        return { ok: true, cleared: true };
      }
      
      await this.repo.upsertMemberDepartment(b.member_id, b.year, b.month, b.department_id);
      return { ok: true };
    });
  }
}
