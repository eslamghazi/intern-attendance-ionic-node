import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../infrastructure/database/generic.repository.js';
import { eq, inArray, asc } from 'drizzle-orm';
import { profiles, adminAssignments, groups, branches } from '../../infrastructure/database/schema/index.js';
import { STAFF_ROLES } from '../../common/enums/index.js';

import type { IAdminsRepository } from './interfaces/admins.interface.js';
import type { AdminPatch } from './admins.types.js';

@Injectable()
export class AdminsRepository extends GenericRepository<typeof profiles> implements IAdminsRepository {
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

  async updateAdmin(id: string, patch: AdminPatch) {
    const rows = await this.db
      .update(profiles)
      .set(patch)
      .where(eq(profiles.id, id))
      .returning({ id: profiles.id });
    return rows[0] ?? null;
  }

  async createAssignment(adminId: string, groupId: string | null, branchId: string | null) {
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

  async deleteAssignment(id: string) {
    const rows = await this.db
      .delete(adminAssignments)
      .where(eq(adminAssignments.id, id))
      .returning({ id: adminAssignments.id });
    return rows[0] ?? null;
  }
}
