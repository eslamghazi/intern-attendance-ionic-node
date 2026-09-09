import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { DepartmentsRepository } from './departments.repository.js';
import type { Caller } from '../../domain/identity/role.js';
import type { JwtClaims } from '../../db/context.js';
import { notFound, forbidden } from '../../http/errors.js';
import { BaseService } from '../../common/database/base.service.js';
import { departments } from '../../db/schema/index.js';
import { DepartmentDto } from './dto/department.dto.js';
import { DepartmentsMapper } from './departments.mapper.js';

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

import type { IDepartmentsService } from './interfaces/departments.interface.js';

@Injectable()
export class DepartmentsService extends BaseService<
  typeof departments.$inferSelect,
  string,
  typeof departments.$inferInsert,
  Partial<typeof departments.$inferInsert>,
  DepartmentDto
> implements IDepartmentsService {
  constructor(
    uow: UnitOfWorkService,
    repo: DepartmentsRepository,
  ) {
    super(uow, repo);
  }

  protected mapToResponse(entity: any): DepartmentDto {
    return DepartmentsMapper.toDto(entity);
  }

  async getDepartments(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      const rows = await (this.repo as DepartmentsRepository).getDepartments();
      return rows.map((r) => DepartmentsMapper.toDto(r));
    });
  }

  async getDepartmentsOptions(claims: JwtClaims, branchId?: string) {
    return this.uow.asCaller(claims, async () => {
      const rows = await (this.repo as DepartmentsRepository).getDepartmentsOptions(branchId);
      return rows.map((r) => DepartmentsMapper.toDto(r));
    });
  }

  async putDepartment(caller: Caller, claims: JwtClaims, d: PutDepartmentPayload) {
    return this.uow.asCaller(claims, async () => {
      const { requireBranch, scopeOf } = await import('../../common/auth/access.service.js');

      if (d.branch_id) {
        await requireBranch((this.repo as any).db, caller, d.branch_id);
      } else if ((await scopeOf((this.repo as any).db, caller)).kind !== 'all') {
        throw forbidden('a faculty-wide department is not yours to create');
      }

      const row = await (this.repo as DepartmentsRepository).upsertDepartment(d.id, d.name, d.branch_id);
      return { ok: true, id: row?.id };
    });
  }

  async deleteDepartment(caller: Caller, claims: JwtClaims, id: string) {
    return this.uow.asCaller(claims, async () => {
      const { requireBranch, scopeOf } = await import('../../common/auth/access.service.js');

      const existing = await (this.repo as DepartmentsRepository).getDepartmentBranchId(id);
      if (!existing) throw notFound();

      if (existing.branchId) {
        await requireBranch((this.repo as any).db, caller, existing.branchId);
      } else if ((await scopeOf((this.repo as any).db, caller)).kind !== 'all') {
        throw forbidden('a faculty-wide department is not yours to delete');
      }

      const deleted = await (this.repo as DepartmentsRepository).deleteDepartment(id);
      if (!deleted) throw notFound();
      
      return { ok: true };
    });
  }

  async getMemberDepartments(claims: JwtClaims, year: number, month: number) {
    return this.uow.asCaller(claims, async () => {
      return (this.repo as DepartmentsRepository).getMemberDepartments(year, month);
    });
  }

  async putMemberDepartment(claims: JwtClaims, b: PutMemberDepartmentPayload) {
    return this.uow.asCaller(claims, async () => {
      if (!b.department_id) {
        await (this.repo as DepartmentsRepository).deleteMemberDepartment(b.member_id, b.year, b.month);
        return { ok: true, cleared: true };
      }
      
      await (this.repo as DepartmentsRepository).upsertMemberDepartment(b.member_id, b.year, b.month, b.department_id);
      return { ok: true };
    });
  }
}
