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
import { GenericRepository } from '../../infrastructure/database/generic.repository.js';
import { departments, branches, memberDepartments, members } from '../../infrastructure/database/schema/index.js';
import { eq, and, asc } from 'drizzle-orm';
let DepartmentsRepository = class DepartmentsRepository extends GenericRepository {
    constructor() {
        super(departments, departments.id);
    }
    async getDepartments() {
        return this.db
            .select({
            id: departments.id,
            name: departments.name,
            branch_id: departments.branchId,
            branch_name: branches.name,
        })
            .from(departments)
            .leftJoin(branches, eq(branches.id, departments.branchId))
            .orderBy(asc(departments.name), asc(departments.id));
    }
    async getDepartmentsOptions(branchId) {
        const queryBuilder = this.db
            .select({ id: departments.id, name: departments.name })
            .from(departments)
            .where(eq(departments.branchId, branchId));
        return queryBuilder.orderBy(asc(departments.name), asc(departments.id));
    }
    /** The hospital a member belongs to, or null when there is no such member. */
    async memberBranchId(memberId) {
        const rows = await this.db
            .select({ branchId: members.branchId })
            .from(members)
            .where(eq(members.id, memberId))
            .limit(1);
        return rows[0]?.branchId ?? null;
    }
    async getDepartmentBranchId(id) {
        const rows = await this.db
            .select({ branchId: departments.branchId })
            .from(departments)
            .where(eq(departments.id, id))
            .limit(1);
        return rows[0] ?? null;
    }
    async upsertDepartment(id, name, branchId) {
        if (id) {
            const rows = await this.db
                .insert(departments)
                .values({ id, name, branchId })
                .onConflictDoUpdate({
                target: departments.id,
                set: { name, branchId },
            })
                .returning({ id: departments.id });
            return rows[0];
        }
        else {
            const rows = await this.db
                .insert(departments)
                .values({ name, branchId })
                .returning({ id: departments.id });
            return rows[0];
        }
    }
    async deleteDepartment(id) {
        const rows = await this.db
            .delete(departments)
            .where(eq(departments.id, id))
            .returning({ id: departments.id });
        return rows[0] ?? null;
    }
    async getMemberDepartments(year, month) {
        const rows = await this.db
            .select({
            member_id: memberDepartments.memberId,
            department_id: memberDepartments.departmentId,
        })
            .from(memberDepartments)
            .where(and(eq(memberDepartments.year, year), eq(memberDepartments.month, month)))
            .orderBy(asc(memberDepartments.memberId));
        return Object.fromEntries(rows.map((r) => [r.member_id, r.department_id]));
    }
    async deleteMemberDepartment(memberId, year, month) {
        await this.db
            .delete(memberDepartments)
            .where(and(eq(memberDepartments.memberId, memberId), eq(memberDepartments.year, year), eq(memberDepartments.month, month)));
    }
    async upsertMemberDepartment(memberId, year, month, departmentId) {
        await this.db
            .insert(memberDepartments)
            .values({
            memberId,
            year,
            month,
            departmentId,
        })
            .onConflictDoUpdate({
            target: [
                memberDepartments.memberId,
                memberDepartments.year,
                memberDepartments.month,
            ],
            set: { departmentId },
        });
    }
};
DepartmentsRepository = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], DepartmentsRepository);
export { DepartmentsRepository };
//# sourceMappingURL=departments.repository.js.map