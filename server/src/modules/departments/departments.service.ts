import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { DepartmentsRepository } from './departments.repository.js';
import type { Caller } from '../../domain/identity/role.js';
import type { JwtClaims } from '../../infrastructure/database/context.js';
import { badRequest, notFound } from '../../common/errors.js';
import { BaseService } from '../../infrastructure/database/base.service.js';
import { departments } from '../../infrastructure/database/schema/index.js';
import { DepartmentDto } from './dto/department.dto.js';
import { DepartmentsMapper } from './departments.mapper.js';

import type { IDepartmentsService } from './interfaces/departments.interface.js';
import type { PutDepartmentPayload, PutMemberDepartmentPayload } from './departments.types.js';
export type { PutDepartmentPayload, PutMemberDepartmentPayload } from './departments.types.js';

@Injectable()
export class DepartmentsService extends BaseService<typeof departments, DepartmentDto> implements IDepartmentsService {
  constructor(
    uow: UnitOfWorkService,
    repo: DepartmentsRepository,
  ) {
    super(uow, repo);
  }

  protected mapToResponse(entity: any): DepartmentDto {
    return DepartmentsMapper.toDto(entity);
  }

  async getDepartments() {
    return this.uow.transaction(async () => {
      const rows = await (this.repo as DepartmentsRepository).getDepartments();
      return rows.map((r) => DepartmentsMapper.toDto(r));
    });
  }

  /** The departments of ONE hospital. Every screen picks the hospital first. */
  async getDepartmentsOptions(branchId: string) {
    return this.uow.transaction(async () => {
      const rows = await (this.repo as DepartmentsRepository).getDepartmentsOptions(branchId);
      return rows.map((r) => DepartmentsMapper.toDto(r));
    });
  }

  /**
   * A department belongs to one hospital, always — so saving one is an act
   * within that hospital, and the caller must reach it.
   */
  async putDepartment(caller: Caller, d: PutDepartmentPayload) {
    return this.uow.transaction(async () => {
      const { requireBranch } = await import('../../common/auth/access.service.js');
      await requireBranch((this.repo as any).db, caller, d.branch_id);
      const row = await (this.repo as DepartmentsRepository).upsertDepartment(d.id, d.name, d.branch_id);
      return { ok: true, id: row?.id };
    });
  }

  async deleteDepartment(caller: Caller, id: string) {
    return this.uow.transaction(async () => {
      const { requireBranch } = await import('../../common/auth/access.service.js');

      const existing = await (this.repo as DepartmentsRepository).getDepartmentBranchId(id);
      if (!existing) throw notFound();
      await requireBranch((this.repo as any).db, caller, existing.branchId);

      const deleted = await (this.repo as DepartmentsRepository).deleteDepartment(id);
      if (!deleted) throw notFound();
      
      return { ok: true };
    });
  }

  async getMemberDepartments(year: number, month: number) {
    return this.uow.transaction(async () => {
      return (this.repo as DepartmentsRepository).getMemberDepartments(year, month);
    });
  }

  async putMemberDepartment(b: PutMemberDepartmentPayload) {
    return this.uow.transaction(async () => {
      if (!b.department_id) {
        await (this.repo as DepartmentsRepository).deleteMemberDepartment(b.member_id, b.year, b.month);
        return { ok: true, cleared: true };
      }

      // A member is placed in a department of THEIR hospital. A department
      // of another hospital is not a choice — the screens never offer one,
      // and this is what makes that a rule rather than a habit.
      const repo = this.repo as DepartmentsRepository;
      const [department, memberBranch] = await Promise.all([
        repo.getDepartmentBranchId(b.department_id),
        repo.memberBranchId(b.member_id),
      ]);
      if (!department) throw notFound();
      if (memberBranch !== null && department.branchId !== memberBranch) {
        throw badRequest('department_not_in_branch', "the department belongs to another hospital");
      }

      await repo.upsertMemberDepartment(b.member_id, b.year, b.month, b.department_id);
      return { ok: true };
    });
  }
}
