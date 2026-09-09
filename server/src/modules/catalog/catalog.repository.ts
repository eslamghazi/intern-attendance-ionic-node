import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../common/database/generic.repository.js';
import { institutions, branches, groups, shifts } from '../../db/schema/index.js';
import { eq, asc, desc } from 'drizzle-orm';
import type { ICatalogRepository } from './interfaces/catalog.interface.js';

@Injectable()
export class CatalogRepository extends GenericRepository<
  typeof institutions.$inferSelect,
  string,
  typeof institutions.$inferInsert,
  Partial<typeof institutions.$inferInsert>
> implements ICatalogRepository {
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

  async insertInstitution(name: string, code: number) {
    const rows = await this.db
      .insert(institutions)
      .values({ name, code })
      .returning({ id: institutions.id });
    return rows[0]!;
  }

  async updateInstitution(id: string, name: string, code: number) {
    const rows = await this.db
      .update(institutions)
      .set({ name, code })
      .where(eq(institutions.id, id))
      .returning({ id: institutions.id });
    return rows[0] ?? null;
  }

  async deleteInstitution(id: string) {
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

  async insertBranch(b: Record<string, any>) {
    const rows = await this.db
      .insert(branches)
      .values(b as any)
      .returning({ id: branches.id });
    return rows[0]!;
  }

  async updateBranch(id: string, b: Record<string, any>) {
    const rows = await this.db
      .update(branches)
      .set(b as any)
      .where(eq(branches.id, id))
      .returning({ id: branches.id });
    return rows[0] ?? null;
  }

  async deleteBranch(id: string) {
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

  async insertGroup(g: Record<string, any>) {
    const rows = await this.db
      .insert(groups)
      .values(g as any)
      .returning({ id: groups.id });
    return rows[0]!;
  }

  async updateGroup(id: string, g: Record<string, any>) {
    const rows = await this.db
      .update(groups)
      .set(g as any)
      .where(eq(groups.id, id))
      .returning({ id: groups.id });
    return rows[0] ?? null;
  }

  async deleteGroup(id: string) {
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

  async insertShift(s: Record<string, any>) {
    const rows = await this.db
      .insert(shifts)
      .values(s as any)
      .returning({ id: shifts.id });
    return rows[0]!;
  }

  async updateShift(id: string, s: Record<string, any>) {
    const rows = await this.db
      .update(shifts)
      .set(s as any)
      .where(eq(shifts.id, id))
      .returning({ id: shifts.id });
    return rows[0] ?? null;
  }

  async deleteShift(id: string) {
    const rows = await this.db
      .delete(shifts)
      .where(eq(shifts.id, id))
      .returning({ id: shifts.id });
    return rows[0] ?? null;
  }
}
