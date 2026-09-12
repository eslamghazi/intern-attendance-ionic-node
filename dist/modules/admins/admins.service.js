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
import { AdminsRepository } from './admins.repository.js';
import { forbidden, notFound } from '../../common/errors.js';
import { mayManageStaff } from '../../domain/identity/role.js';
import { BaseService } from '../../infrastructure/database/base.service.js';
import { AdminsMapper } from './admins.mapper.js';
let AdminsService = class AdminsService extends BaseService {
    constructor(uow, repo) {
        super(uow, repo);
    }
    mapToResponse(entity) {
        return AdminsMapper.toDto(entity);
    }
    /**
     * The staff accounts the caller manages — everyone but themselves.
     *
     * A superadmin's own row has nothing to do on this screen: it cannot be
     * granted pages (a superadmin holds them all), cannot be deleted by its
     * owner, and its password is changed from the profile, not here. Listing it
     * only offered ways to lock oneself out.
     */
    async getAdmins(caller) {
        return this.uow.transaction(async () => {
            const rows = await this.repo.getAdmins(caller.id);
            return AdminsMapper.toList(rows);
        });
    }
    async getAssignments() {
        return this.uow.transaction(async () => {
            const rows = await this.repo.getAssignments();
            return AdminsMapper.toAssignmentList(rows);
        });
    }
    /**
     * The target must be the actor's to manage — see mayManageStaff. Read
     * inside the transaction, so the role checked is the role written against.
     */
    async requireManageable(actor, targetId) {
        const role = await this.repo.staffRole(targetId);
        if (!role)
            throw notFound();
        if (!mayManageStaff(actor, targetId, role)) {
            throw forbidden('not yours to manage');
        }
    }
    async updateAdmin(actor, id, b) {
        return this.uow.transaction(async () => {
            await this.requireManageable(actor, id);
            const patch = {
                fullName: b.full_name,
                nationalId: b.national_id,
                phone: b.phone || null,
            };
            // `null` clears the grant and is a real edit; `undefined` is the caller
            // not mentioning permissions at all, which must leave them standing.
            if (b.permissions !== undefined) {
                patch.permissions = b.permissions;
            }
            const updated = await this.repo.updateAdmin(id, patch);
            if (!updated)
                throw notFound();
            return { ok: true };
        });
    }
    async createAssignment(actor, adminId, groupId, branchId) {
        return this.uow.transaction(async () => {
            await this.requireManageable(actor, adminId);
            const created = await this.repo.createAssignment(adminId, groupId, branchId);
            if (!created)
                throw notFound();
            return AdminsMapper.toAssignmentDto(created);
        });
    }
    async deleteAssignment(actor, id) {
        return this.uow.transaction(async () => {
            const owner = await this.repo.assignmentOwner(id);
            if (!owner)
                throw notFound();
            if (!mayManageStaff(actor, owner.adminId, owner.role))
                throw forbidden('not yours to manage');
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