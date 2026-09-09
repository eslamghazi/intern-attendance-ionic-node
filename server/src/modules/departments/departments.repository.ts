import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../common/database/generic.repository.js';
import { departments, branches, memberDepartments } from '../../db/schema/index.js';
import { eq, and, asc } from 'drizzle-orm';

@Injectable()
export class DepartmentsRepository extends GenericRepository<typeof departments.$inferSelect, string, typeof departments.$inferInsert, Partial<typeof departments.$inferInsert>> {
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

  async getDepartmentsOptions(branchId?: string) {
    const queryBuilder = this.db
      .select({ id: departments.id, name: departments.name })
      .from(departments);

    if (branchId) {
      queryBuilder.where(eq(departments.branchId, branchId));
    }

    return queryBuilder.orderBy(asc(departments.name), asc(departments.id));
  }

  async getDepartmentBranchId(id: string) {
    const rows = await this.db
      .select({ branchId: departments.branchId })
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async upsertDepartment(id: string | undefined, name: string, branchId: string | null) {
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
    } else {
      const rows = await this.db
        .insert(departments)
        .values({ name, branchId })
        .returning({ id: departments.id });
      return rows[0];
    }
  }

  async deleteDepartment(id: string) {
    const rows = await this.db
      .delete(departments)
      .where(eq(departments.id, id))
      .returning({ id: departments.id });
    return rows[0] ?? null;
  }

  async getMemberDepartments(year: number, month: number) {
    const rows = await this.db
      .select({
        member_id: memberDepartments.memberId,
        department_id: memberDepartments.departmentId,
      })
      .from(memberDepartments)
      .where(
        and(
          eq(memberDepartments.year, year),
          eq(memberDepartments.month, month),
        ),
      )
      .orderBy(asc(memberDepartments.memberId));
    return Object.fromEntries(rows.map((r) => [r.member_id, r.department_id]));
  }

  async deleteMemberDepartment(memberId: string, year: number, month: number) {
    await this.db
      .delete(memberDepartments)
      .where(
        and(
          eq(memberDepartments.memberId, memberId),
          eq(memberDepartments.year, year),
          eq(memberDepartments.month, month),
        ),
      );
  }

  async upsertMemberDepartment(memberId: string, year: number, month: number, departmentId: string) {
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
}
