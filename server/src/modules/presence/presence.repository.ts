import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../infrastructure/database/generic.repository.js';
import { presenceChecks, presenceConfirmations, members, attendance, profiles, memberDepartments } from '../../infrastructure/database/schema/index.js';
import { eq, inArray, isNull, isNotNull, and, desc, asc, notExists, exists, gt, arrayContains } from 'drizzle-orm';
import { PresenceStatus, PresenceDecision, CheckoutStatus } from '../../common/enums/index.js';

import type { IPresenceRepository } from './interfaces/presence.interface.js';

@Injectable()
export class PresenceRepository extends GenericRepository<typeof presenceChecks> implements IPresenceRepository {
  constructor() {
    super(presenceChecks, presenceChecks.id);
  }

  async getOwnedCheck(checkId: string, callerId: string) {
    const rows = await this.db
      .select()
      .from(presenceChecks)
      .where(eq(presenceChecks.id, checkId))
      .limit(1);
      
    const check = rows[0];
    if (!check || check.createdBy !== callerId) return null;
    return check;
  }

  async getCheck(checkId: string) {
    const rows = await this.db
      .select()
      .from(presenceChecks)
      .where(eq(presenceChecks.id, checkId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findActiveTargets(
    dates: string[],
    branchId: string | null,
    groupId: string | null,
    departmentId: string | null,
    year: number,
    month: number,
  ) {
    const conditions = [
      inArray(attendance.date, dates),
      isNotNull(attendance.checkInAt),
      isNull(attendance.checkOutAt),
    ];

    if (branchId) conditions.push(eq(members.branchId, branchId));
    if (groupId) conditions.push(eq(members.groupId, groupId));

    if (departmentId) {
      conditions.push(
        exists(
          this.db
            .select({ id: memberDepartments.id })
            .from(memberDepartments)
            .where(
              and(
                eq(memberDepartments.memberId, attendance.memberId),
                eq(memberDepartments.year, year),
                eq(memberDepartments.month, month),
                eq(memberDepartments.departmentId, departmentId),
              ),
            ),
        ),
      );
    }

    const rows = await this.db
      .selectDistinct({ member_id: attendance.memberId })
      .from(attendance)
      .innerJoin(members, eq(members.id, attendance.memberId))
      .where(and(...conditions));

    return rows.map((r) => r.member_id);
  }

  async createCheck(data: {
    createdBy: string;
    branchId: string | null;
    groupId: string | null;
    departmentId: string | null;
    shiftId: string | null;
    date: string;
    deadline: string;
    targetMemberIds: string[];
  }) {
    const rows = await this.db
      .insert(presenceChecks)
      .values({
        createdBy: data.createdBy,
        branchId: data.branchId,
        groupId: data.groupId,
        departmentId: data.departmentId,
        shiftId: data.shiftId,
        date: data.date,
        deadline: data.deadline,
        targetMemberIds: data.targetMemberIds,
        status: PresenceStatus.OPEN,
      })
      .returning();
    return rows[0]!;
  }

  async getRecentChecks(callerId: string, limit: number = 20) {
    return this.db
      .select()
      .from(presenceChecks)
      .where(eq(presenceChecks.createdBy, callerId))
      .orderBy(desc(presenceChecks.createdAt))
      .limit(limit);
  }

  async getProfilesForMembers(memberIds: string[]) {
    if (!memberIds.length) return [];
    
    return this.db
      .select({
        memberId: members.id,
        fullName: profiles.fullName,
      })
      .from(members)
      .innerJoin(profiles, eq(profiles.id, members.profileId))
      .where(inArray(members.id, memberIds));
  }

  async getConfirmationsForChecks(checkIds: string[]) {
    if (!checkIds.length) return [];
    
    return this.db
      .select({
        checkId: presenceConfirmations.checkId,
        memberId: presenceConfirmations.memberId,
      })
      .from(presenceConfirmations)
      .where(inArray(presenceConfirmations.checkId, checkIds));
  }

  async deleteCheck(id: string) {
    await this.db.delete(presenceChecks).where(eq(presenceChecks.id, id));
  }

  async confirmCheck(checkId: string, memberId: string) {
    await this.db
      .insert(presenceConfirmations)
      .values({ checkId, memberId })
      .onConflictDoNothing();
  }

  async resolveLeftWork(checkId: string, checkDate: string, checkShiftId: string | null, targetIds: string[]) {
    if (!targetIds.length) return;

    const conditions = [
      eq(attendance.date, checkDate),
      isNull(attendance.checkOutAt),
      inArray(attendance.memberId, targetIds),
      notExists(
        this.db
          .select({ id: presenceConfirmations.id })
          .from(presenceConfirmations)
          .where(
            and(
              eq(presenceConfirmations.checkId, checkId),
              eq(presenceConfirmations.memberId, attendance.memberId),
            ),
          ),
      ),
    ];

    if (checkShiftId) {
      conditions.push(eq(attendance.shiftId, checkShiftId));
    }

    await this.db
      .update(attendance)
      .set({ checkoutStatus: CheckoutStatus.LEFT_WORK })
      .where(and(...conditions));
  }

  async markCheckResolved(id: string, decision: string) {
    await this.db
      .update(presenceChecks)
      .set({
        status: PresenceStatus.RESOLVED,
        decision,
        resolvedAt: new Date().toISOString(),
      })
      .where(eq(presenceChecks.id, id));
  }

  async getMemberIdByProfileId(profileId: string) {
    const rows = await this.db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.profileId, profileId))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  async getPendingCheckForMember(memberId: string) {
    const rows = await this.db
      .select({ check_id: presenceChecks.id, deadline: presenceChecks.deadline })
      .from(presenceChecks)
      .where(
        and(
          eq(presenceChecks.status, PresenceStatus.OPEN),
          gt(presenceChecks.deadline, new Date().toISOString()),
          arrayContains(presenceChecks.targetMemberIds, [memberId]),
          notExists(
            this.db
              .select({ id: presenceConfirmations.id })
              .from(presenceConfirmations)
              .where(
                and(
                  eq(presenceConfirmations.checkId, presenceChecks.id),
                  eq(presenceConfirmations.memberId, memberId),
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(presenceChecks.deadline))
      .limit(1);

    return rows[0] ?? null;
  }
}
