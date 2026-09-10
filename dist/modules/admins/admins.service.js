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
import { AdminsRepository } from './admins.repository.js';
import { notFound } from '../../http/errors.js';
import { BaseService } from '../../common/database/base.service.js';
import { AdminsMapper } from './admins.mapper.js';
let AdminsService = class AdminsService extends BaseService {
    constructor(uow, repo) {
        super(uow, repo);
    }
    mapToResponse(entity) {
        return AdminsMapper.toDto(entity);
    }
    async getAdmins(claims) {
        return this.uow.asCaller(claims, async () => {
            const rows = await this.repo.getAdmins();
            return AdminsMapper.toList(rows);
        });
    }
    async getAssignments(claims) {
        return this.uow.asCaller(claims, async () => {
            const rows = await this.repo.getAssignments();
            return AdminsMapper.toAssignmentList(rows);
        });
    }
    async updateAdmin(claims, id, b) {
        return this.uow.asCaller(claims, async () => {
            const patch = {
                fullName: b.full_name,
                nationalId: b.national_id,
                phone: b.phone || null,
            };
            if (b.permissions !== undefined) {
                patch.permissions = b.permissions;
            }
            const updated = await this.repo.updateAdmin(id, patch);
            if (!updated)
                throw notFound();
            return { ok: true };
        });
    }
    async createAssignment(claims, adminId, groupId, branchId) {
        return this.uow.asCaller(claims, async () => {
            const created = await this.repo.createAssignment(adminId, groupId, branchId);
            if (!created)
                throw notFound();
            return AdminsMapper.toAssignmentDto(created);
        });
    }
    async deleteAssignment(claims, id) {
        return this.uow.asCaller(claims, async () => {
            const deleted = await this.repo.deleteAssignment(id);
            if (!deleted)
                throw notFound();
        });
    }
};
AdminsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        AdminsRepository])
], AdminsService);
export { AdminsService };
//# sourceMappingURL=admins.service.js.map