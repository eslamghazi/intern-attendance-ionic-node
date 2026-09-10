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
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { DepartmentsRepository } from './departments.repository.js';
import { notFound, forbidden } from '../../http/errors.js';
import { BaseService } from '../../common/database/base.service.js';
import { DepartmentsMapper } from './departments.mapper.js';
let DepartmentsService = class DepartmentsService extends BaseService {
    constructor(uow, repo) {
        super(uow, repo);
    }
    mapToResponse(entity) {
        return DepartmentsMapper.toDto(entity);
    }
    async getDepartments(claims) {
        return this.uow.asCaller(claims, async () => {
            const rows = await this.repo.getDepartments();
            return rows.map((r) => DepartmentsMapper.toDto(r));
        });
    }
    async getDepartmentsOptions(claims, branchId) {
        return this.uow.asCaller(claims, async () => {
            const rows = await this.repo.getDepartmentsOptions(branchId);
            return rows.map((r) => DepartmentsMapper.toDto(r));
        });
    }
    async putDepartment(caller, claims, d) {
        return this.uow.asCaller(claims, async () => {
            const { requireBranch, scopeOf } = await import('../../common/auth/access.service.js');
            if (d.branch_id) {
                await requireBranch(this.repo.db, caller, d.branch_id);
            }
            else if ((await scopeOf(this.repo.db, caller)).kind !== 'all') {
                throw forbidden('a faculty-wide department is not yours to create');
            }
            const row = await this.repo.upsertDepartment(d.id, d.name, d.branch_id);
            return { ok: true, id: row?.id };
        });
    }
    async deleteDepartment(caller, claims, id) {
        return this.uow.asCaller(claims, async () => {
            const { requireBranch, scopeOf } = await import('../../common/auth/access.service.js');
            const existing = await this.repo.getDepartmentBranchId(id);
            if (!existing)
                throw notFound();
            if (existing.branchId) {
                await requireBranch(this.repo.db, caller, existing.branchId);
            }
            else if ((await scopeOf(this.repo.db, caller)).kind !== 'all') {
                throw forbidden('a faculty-wide department is not yours to delete');
            }
            const deleted = await this.repo.deleteDepartment(id);
            if (!deleted)
                throw notFound();
            return { ok: true };
        });
    }
    async getMemberDepartments(claims, year, month) {
        return this.uow.asCaller(claims, async () => {
            return this.repo.getMemberDepartments(year, month);
        });
    }
    async putMemberDepartment(claims, b) {
        return this.uow.asCaller(claims, async () => {
            if (!b.department_id) {
                await this.repo.deleteMemberDepartment(b.member_id, b.year, b.month);
                return { ok: true, cleared: true };
            }
            await this.repo.upsertMemberDepartment(b.member_id, b.year, b.month, b.department_id);
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