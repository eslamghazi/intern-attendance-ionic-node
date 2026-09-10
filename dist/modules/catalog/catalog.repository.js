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
import { institutions, branches, groups, shifts } from '../../db/schema/index.js';
import { eq, asc, desc } from 'drizzle-orm';
let CatalogRepository = class CatalogRepository extends GenericRepository {
    constructor() {
        super(institutions, institutions.id);
    }
    /* Institutions */
    async getInstitutions() {
        return this.db
            .select()
            .from(institutions)
            .orderBy(asc(institutions.code), asc(institutions.id));
    }
    async insertInstitution(name, code) {
        const rows = await this.db
            .insert(institutions)
            .values({ name, code })
            .returning({ id: institutions.id });
        return rows[0];
    }
    async updateInstitution(id, name, code) {
        const rows = await this.db
            .update(institutions)
            .set({ name, code })
            .where(eq(institutions.id, id))
            .returning({ id: institutions.id });
        return rows[0] ?? null;
    }
    async deleteInstitution(id) {
        const rows = await this.db
            .delete(institutions)
            .where(eq(institutions.id, id))
            .returning({ id: institutions.id });
        return rows[0] ?? null;
    }
    /* Branches */
    async getBranches() {
        return this.db
            .select()
            .from(branches)
            .orderBy(asc(branches.name), asc(branches.id));
    }
    async getBranchesOptions() {
        return this.db
            .select({ id: branches.id, name: branches.name })
            .from(branches)
            .orderBy(asc(branches.name), asc(branches.id));
    }
    async insertBranch(b) {
        const rows = await this.db
            .insert(branches)
            .values(b)
            .returning({ id: branches.id });
        return rows[0];
    }
    async updateBranch(id, b) {
        const rows = await this.db
            .update(branches)
            .set(b)
            .where(eq(branches.id, id))
            .returning({ id: branches.id });
        return rows[0] ?? null;
    }
    async deleteBranch(id) {
        const rows = await this.db
            .delete(branches)
            .where(eq(branches.id, id))
            .returning({ id: branches.id });
        return rows[0] ?? null;
    }
    /* Groups */
    async getGroups() {
        return this.db
            .select()
            .from(groups)
            .orderBy(desc(groups.year), asc(groups.id));
    }
    async getGroupsOptions() {
        return this.db
            .select({ id: groups.id, name: groups.name })
            .from(groups)
            .orderBy(asc(groups.name), asc(groups.id));
    }
    async insertGroup(g) {
        const rows = await this.db
            .insert(groups)
            .values(g)
            .returning({ id: groups.id });
        return rows[0];
    }
    async updateGroup(id, g) {
        const rows = await this.db
            .update(groups)
            .set(g)
            .where(eq(groups.id, id))
            .returning({ id: groups.id });
        return rows[0] ?? null;
    }
    async deleteGroup(id) {
        const rows = await this.db
            .delete(groups)
            .where(eq(groups.id, id))
            .returning({ id: groups.id });
        return rows[0] ?? null;
    }
    /* Shifts */
    async getShifts() {
        return this.db
            .select()
            .from(shifts)
            .orderBy(asc(shifts.startTime), asc(shifts.id));
    }
    async getShiftsKeys() {
        return this.db
            .select({ id: shifts.id, key: shifts.key })
            .from(shifts)
            .orderBy(asc(shifts.id));
    }
    async insertShift(s) {
        const rows = await this.db
            .insert(shifts)
            .values(s)
            .returning({ id: shifts.id });
        return rows[0];
    }
    async updateShift(id, s) {
        const rows = await this.db
            .update(shifts)
            .set(s)
            .where(eq(shifts.id, id))
            .returning({ id: shifts.id });
        return rows[0] ?? null;
    }
    async deleteShift(id) {
        const rows = await this.db
            .delete(shifts)
            .where(eq(shifts.id, id))
            .returning({ id: shifts.id });
        return rows[0] ?? null;
    }
};
CatalogRepository = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], CatalogRepository);
export { CatalogRepository };
//# sourceMappingURL=catalog.repository.js.map