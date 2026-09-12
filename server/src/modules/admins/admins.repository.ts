import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../infrastructure/database/generic.repository.js';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { profiles, adminAssignments, groups, branches } from '../../infrastructure/database/schema/index.js';
import { STAFF_ROLES, type Role } from '../../common/enums/index.js';
import { FIRST_SUPERADMIN } from '../../config/constants.js';

import type { IAdminsRepository } from './interfaces/admins.interface.js';
import type { AdminPatch } from './admins.types.js';

@Injectable()
export class AdminsRepository extends GenericRepository<typeof profiles> implements IAdminsRepository {
  constructor() {
    super(profiles, profiles.id);
  }
  /** Every staff account except the one asking. */
  async getAdmins(exceptId: string) {
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
      .where(
        and(
          inArray(profiles.role, STAFF_ROLES),
          ne(profiles.id, exceptId),
          // The seeded superadmin is nobody's business — see isHiddenAccount.
          ne(profiles.nationalId, FIRST_SUPERADMIN.nationalId),
        ),
      )
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

  /** The staff account an assignment belongs to, with its role — or null. */
  async assignmentOwner(id: string) {
    const rows = await this.db
      .select({ adminId: adminAssignments.adminId, role: profiles.role })
      .from(adminAssignments)
      .innerJoin(profiles, eq(profiles.id, adminAssignments.adminId))
      .where(eq(adminAssignments.id, id))
      .limit(1);
    const row = rows[0];
    // The enum column is typed as its string union; Role is the same set.
    return row ? { adminId: row.adminId, role: row.role as Role } : null;
  }

  /** A staff account's role, or null when there is no staff account with that id. */
  async staffRole(id: string) {
    const rows = await this.db
      .select({ role: profiles.role })
      .from(profiles)
      .where(
        and(
          eq(profiles.id, id),
          inArray(profiles.role, STAFF_ROLES),
          // Not manageable by anyone, and not reported as existing.
          ne(profiles.nationalId, FIRST_SUPERADMIN.nationalId),
        ),
      )
      .limit(1);
    return (rows[0]?.role as Role | undefined) ?? null;
  }

  async deleteAssignment(id: string) {
    const rows = await this.db
      .delete(adminAssignments)
      .where(eq(adminAssignments.id, id))
      .returning({ id: adminAssignments.id });
    return rows[0] ?? null;
  }
}
