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
import { GenericRepository } from '../../common/database/generic.repository.js';
import { eq, inArray, asc } from 'drizzle-orm';
import { profiles, adminAssignments, groups, branches } from '../../db/schema/index.js';
import { STAFF_ROLES } from '../../common/enums/index.js';
let AdminsRepository = class AdminsRepository extends GenericRepository {
    constructor() {
        super(profiles, profiles.id);
    }
    async getAdmins() {
        return this.db
            .select({
            id: profiles.id,
            full_name: profiles.fullName,
            national_id: profiles.nationalId,
            phone: profiles.phone,
            role: profiles.role,
            permissions: profiles.permissions,
        })
            .from(profiles)
            .where(inArray(profiles.role, STAFF_ROLES))
            .orderBy(asc(profiles.fullName), asc(profiles.id));
    }
    async getAssignments() {
        const rows = await this.db
            .select({
            id: adminAssignments.id,
            admin_id: adminAssignments.adminId,
            group_id: adminAssignments.groupId,
            branch_id: adminAssignments.branchId,
            group: groups.name,
            branch: branches.name,
        })
            .from(adminAssignments)
            .leftJoin(groups, eq(groups.id, adminAssignments.groupId))
            .leftJoin(branches, eq(branches.id, adminAssignments.branchId))
            .orderBy(asc(adminAssignments.id));
        return rows.map((r) => ({
            id: r.id,
            admin_id: r.admin_id,
            group_id: r.group_id,
            branch_id: r.branch_id,
            group: r.group ? { name: r.group } : null,
            branch: r.branch ? { name: r.branch } : null,
        }));
    }
    async updateAdmin(id, patch) {
        const rows = await this.db
            .update(profiles)
            .set(patch)
            .where(eq(profiles.id, id))
            .returning({ id: profiles.id });
        return rows[0] ?? null;
    }
    async createAssignment(adminId, groupId, branchId) {
        const rows = await this.db
            .insert(adminAssignments)
            .values({
            adminId,
            groupId,
            branchId,
        })
            .returning({ id: adminAssignments.id });
        return rows[0] ?? null;
    }
    async deleteAssignment(id) {
        const rows = await this.db
            .delete(adminAssignments)
            .where(eq(adminAssignments.id, id))
            .returning({ id: adminAssignments.id });
        return rows[0] ?? null;
    }
};
AdminsRepository = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], AdminsRepository);
export { AdminsRepository };
//# sourceMappingURL=admins.repository.js.map