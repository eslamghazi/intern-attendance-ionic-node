var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { DepartmentsRepository } from './departments.repository.js';
import { badRequest, notFound } from '../../common/errors.js';
import { BaseService } from '../../infrastructure/database/base.service.js';
import { DepartmentsMapper } from './departments.mapper.js';
let DepartmentsService = class DepartmentsService extends BaseService {
    constructor(uow, repo) {
        super(uow, repo);
    }
    mapToResponse(entity) {
        return DepartmentsMapper.toDto(entity);
    }
    async getDepartments() {
        return this.uow.transaction(async () => {
            const rows = await this.repo.getDepartments();
            return rows.map((r) => DepartmentsMapper.toDto(r));
        });
    }
    /** The departments of ONE hospital. Every screen picks the hospital first. */
    async getDepartmentsOptions(branchId) {
        return this.uow.transaction(async () => {
            const rows = await this.repo.getDepartmentsOptions(branchId);
            return rows.map((r) => DepartmentsMapper.toDto(r));
        });
    }
    /**
     * A department belongs to one hospital, always — so saving one is an act
     * within that hospital, and the caller must reach it.
     */
    async putDepartment(caller, d) {
        return this.uow.transaction(async () => {
            const { requireBranch } = await import('../../common/auth/access.service.js');
            await requireBranch(this.repo.db, caller, d.branch_id);
            const row = await this.repo.upsertDepartment(d.id, d.name, d.branch_id);
            return { ok: true, id: row?.id };
        });
    }
    async deleteDepartment(caller, id) {
        return this.uow.transaction(async () => {
            const { requireBranch } = await import('../../common/auth/access.service.js');
            const existing = await this.repo.getDepartmentBranchId(id);
            if (!existing)
                throw notFound();
            await requireBranch(this.repo.db, caller, existing.branchId);
            const deleted = await this.repo.deleteDepartment(id);
            if (!deleted)
                throw notFound();
            return { ok: true };
        });
    }
    async getMemberDepartments(year, month) {
        return this.uow.transaction(async () => {
            return this.repo.getMemberDepartments(year, month);
        });
    }
    async putMemberDepartment(b) {
        return this.uow.transaction(async () => {
            if (!b.department_id) {
                await this.repo.deleteMemberDepartment(b.member_id, b.year, b.month);
                return { ok: true, cleared: true };
            }
            // A member is placed in a department of THEIR hospital. A department
            // of another hospital is not a choice — the screens never offer one,
            // and this is what makes that a rule rather than a habit.
            const repo = this.repo;
            const [department, memberBranch] = await Promise.all([
                repo.getDepartmentBranchId(b.department_id),
                repo.memberBranchId(b.member_id),
            ]);
            if (!department)
                throw notFound();
            if (memberBranch !== null && department.branchId !== memberBranch) {
                throw badRequest('department_not_in_branch', "the department belongs to another hospital");
            }
            await repo.upsertMemberDepartment(b.member_id, b.year, b.month, b.department_id);
            return { ok: true };
        });
    }
};
DepartmentsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        DepartmentsRepository])
], DepartmentsService);
export { DepartmentsService };
//# sourceMappingURL=departments.service.js.map