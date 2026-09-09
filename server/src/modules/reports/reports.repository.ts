import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../common/database/generic.repository.js';
import {
  attendance,
  members,
  profiles,
  branches,
  groups,
  rosterDays,
  shifts,
  memberDepartments,
  memberDirectory,
} from '../../db/schema/index.js';
import {
  eq,
  inArray,
  isNull,
  isNotNull,
  and,
  desc,
  asc,
  notExists,
  between,
  exists,
  sql,
} from 'drizzle-orm';
import { directoryWhere } from '../../domain/member/filter.js';

@Injectable()
export class ReportsRepository extends GenericRepository<
  typeof attendance.$inferSelect,
  string,
  typeof attendance.$inferInsert,
  Partial<typeof attendance.$inferInsert>
> {
  constructor() {
    super(attendance, attendance.id);
  }

  async getPresent(dates: string[]) {
    return this.db
      .select({
        member_id: attendance.memberId,
        date: attendance.date,
        shift_id: attendance.shiftId,
        shift_name: attendance.shiftName,
        status: attendance.status,
        checkout_status: attendance.checkoutStatus,
        check_in_at: attendance.checkInAt,
        full_name: profiles.fullName,
        national_id: profiles.nationalId,
        branch_id: members.branchId,
        branch_name: branches.name,
        group_id: members.groupId,
        group_name: groups.name,
      })
      .from(attendance)
      .innerJoin(members, eq(members.id, attendance.memberId))
      .innerJoin(profiles, eq(profiles.id, members.profileId))
      .leftJoin(branches, eq(branches.id, members.branchId))
      .leftJoin(groups, eq(groups.id, members.groupId))
      .where(
        and(
          inArray(attendance.date, dates),
          isNotNull(attendance.checkInAt),
          isNull(attendance.checkOutAt),
        ),
      )
      .orderBy(asc(attendance.checkInAt));
  }

  async getReview(date: string, branchId?: string | null) {
    const conditions = [eq(attendance.date, date)];
    if (branchId) conditions.push(eq(attendance.branchId, branchId));

    return this.db
      .select({
        attendance,
        profile_full_name: profiles.fullName,
        profile_national_id: profiles.nationalId,
      })
      .from(attendance)
      .innerJoin(members, eq(members.id, attendance.memberId))
      .innerJoin(profiles, eq(profiles.id, members.profileId))
      .where(and(...conditions))
      .orderBy(asc(attendance.checkInAt), asc(attendance.id));
  }

  async getDetail(memberId: string, date: string, shiftId?: string | null) {
    const conditions = [eq(attendance.memberId, memberId), eq(attendance.date, date)];
    if (shiftId) conditions.push(eq(attendance.shiftId, shiftId));

    const rows = await this.db
      .select({
        attendance,
        profile_full_name: profiles.fullName,
        profile_national_id: profiles.nationalId,
      })
      .from(attendance)
      .innerJoin(members, eq(members.id, attendance.memberId))
      .innerJoin(profiles, eq(profiles.id, members.profileId))
      .where(and(...conditions))
      .orderBy(desc(attendance.checkInAt))
      .limit(1);

    return rows[0] ?? null;
  }

  async getAttendanceHistorySimple(memberId: string) {
    return this.db
      .select({
        id: attendance.id,
        date: attendance.date,
        shift_id: attendance.shiftId,
        shift_name: attendance.shiftName,
        status: attendance.status,
        check_in_at: attendance.checkInAt,
        check_out_at: attendance.checkOutAt,
        checkout_status: attendance.checkoutStatus,
      })
      .from(attendance)
      .where(eq(attendance.memberId, memberId))
      .orderBy(desc(attendance.date))
      .limit(100);
  }

  async getRosterBetween(memberId: string, first: string, last: string) {
    return this.db
      .select({
        date: rosterDays.date,
        shift_id: rosterDays.shiftId,
        shift_name: shifts.name,
        done: sql<boolean>`public.slot_concluded(${rosterDays.date}, ${rosterDays.shiftId})`,
      })
      .from(rosterDays)
      .leftJoin(shifts, eq(shifts.id, rosterDays.shiftId))
      .where(
        and(
          eq(rosterDays.memberId, memberId),
          between(rosterDays.date, first, last),
        ),
      );
  }

  async getAttendanceBetween(memberId: string, first: string, last: string) {
    return this.db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.memberId, memberId),
          between(attendance.date, first, last),
        ),
      );
  }

  async getRosterDayWithShift(memberId: string, date: string) {
    return this.db
      .select({ shift: shifts })
      .from(rosterDays)
      .innerJoin(shifts, eq(shifts.id, rosterDays.shiftId))
      .where(and(eq(rosterDays.memberId, memberId), eq(rosterDays.date, date)))
      .orderBy(asc(shifts.startTime));
  }

  async getAttendanceDayWithShift(memberId: string, date: string) {
    return this.db
      .select({
        id: attendance.id,
        date: attendance.date,
        shift_id: attendance.shiftId,
        shift_name: attendance.shiftName,
        status: attendance.status,
        check_in_at: attendance.checkInAt,
        check_out_at: attendance.checkOutAt,
        shift: shifts,
      })
      .from(attendance)
      .leftJoin(shifts, eq(shifts.id, attendance.shiftId))
      .where(and(eq(attendance.memberId, memberId), eq(attendance.date, date)))
      .orderBy(asc(attendance.checkInAt));
  }

  async getDailyExpected(date: string, branchId?: string | null) {
    const conditions = [eq(rosterDays.date, date)];
    if (branchId) conditions.push(eq(members.branchId, branchId));

    return this.db
      .select({
        member_id: rosterDays.memberId,
        shift_id: rosterDays.shiftId,
        shift: shifts,
        full_name: profiles.fullName,
        national_id: profiles.nationalId,
        done: sql<boolean>`public.slot_concluded(${rosterDays.date}, ${rosterDays.shiftId})`,
      })
      .from(rosterDays)
      .innerJoin(members, eq(members.id, rosterDays.memberId))
      .innerJoin(profiles, eq(profiles.id, members.profileId))
      .leftJoin(shifts, eq(shifts.id, rosterDays.shiftId))
      .where(and(...conditions));
  }

  async getDailyAttendance(date: string, branchId?: string | null) {
    const conditions = [eq(attendance.date, date)];
    if (branchId) conditions.push(eq(attendance.branchId, branchId));

    return this.db
      .select({
        member_id: attendance.memberId,
        check_in_at: attendance.checkInAt,
        check_out_at: attendance.checkOutAt,
        status: attendance.status,
        full_name: profiles.fullName,
        national_id: profiles.nationalId,
      })
      .from(attendance)
      .innerJoin(members, eq(members.id, attendance.memberId))
      .innerJoin(profiles, eq(profiles.id, members.profileId))
      .where(and(...conditions));
  }

  async getMemberDirectoryPage(filters: any, year: number, month: number, pageSize: number, offset: number) {
    return this.db
      .select({
        member_id: memberDirectory.memberId,
        full_name: memberDirectory.fullName,
        national_id: memberDirectory.nationalId,
      })
      .from(memberDirectory)
      .where(directoryWhere({ ...filters, year, month }))
      .orderBy(asc(memberDirectory.fullName), asc(memberDirectory.memberId))
      .limit(pageSize)
      .offset(offset);
  }

  async getMemberDirectoryCount(filters: any, year: number, month: number) {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(memberDirectory)
      .where(directoryWhere({ ...filters, year, month }));
    return Number(rows[0]?.count ?? 0);
  }

  async getRosterForMembersBetween(memberIds: string[], first: string, last: string) {
    if (!memberIds.length) return [];
    return this.db
      .select({
        member_id: rosterDays.memberId,
        date: rosterDays.date,
        shift_id: rosterDays.shiftId,
        done: sql<boolean>`public.slot_concluded(${rosterDays.date}, ${rosterDays.shiftId})`,
      })
      .from(rosterDays)
      .where(
        and(
          inArray(rosterDays.memberId, memberIds),
          between(rosterDays.date, first, last),
        ),
      );
  }

  async getAttendanceForMembersBetween(memberIds: string[], first: string, last: string) {
    if (!memberIds.length) return [];
    return this.db
      .select({
        member_id: attendance.memberId,
        date: attendance.date,
        shift_id: attendance.shiftId,
        check_in_at: attendance.checkInAt,
        status: attendance.status,
        checkout_status: attendance.checkoutStatus,
      })
      .from(attendance)
      .where(
        and(
          inArray(attendance.memberId, memberIds),
          between(attendance.date, first, last),
          isNotNull(attendance.checkInAt),
        ),
      );
  }

  async getReportAttendanceBetween(from: string, to: string, branchId?: string | null, groupId?: string | null) {
    const conditions = [between(attendance.date, from, to)];
    if (branchId) conditions.push(eq(attendance.branchId, branchId));
    if (groupId) conditions.push(eq(members.groupId, groupId));

    return this.db
      .select({
        date: attendance.date,
        status: attendance.status,
        check_in_at: attendance.checkInAt,
        check_out_at: attendance.checkOutAt,
        group_id: members.groupId,
        profile_full_name: profiles.fullName,
        profile_national_id: profiles.nationalId,
        group_name: groups.name,
        branch_name: branches.name,
        attendance_id: attendance.id,
      })
      .from(attendance)
      .innerJoin(members, eq(members.id, attendance.memberId))
      .innerJoin(profiles, eq(profiles.id, members.profileId))
      .leftJoin(groups, eq(groups.id, members.groupId))
      .leftJoin(branches, eq(branches.id, members.branchId))
      .where(and(...conditions))
      .orderBy(desc(attendance.date), asc(attendance.id));
  }

  async getTodayAttendance(date: string) {
    return this.db
      .select({
        status: attendance.status,
        check_in_at: attendance.checkInAt,
        branch_id: attendance.branchId,
        group_id: members.groupId,
      })
      .from(attendance)
      .innerJoin(members, eq(members.id, attendance.memberId))
      .where(eq(attendance.date, date))
      .orderBy(asc(attendance.id));
  }

  async getStatsAttendance(
    first: string,
    last: string,
    f: { branchId?: string | null; groupId?: string | null; shiftId?: string | null; day?: number | null; departmentId?: string | null },
  ) {
    const conditions = [between(attendance.date, first, last)];
    if (f.branchId) conditions.push(eq(attendance.branchId, f.branchId));
    if (f.groupId) conditions.push(eq(members.groupId, f.groupId));
    if (f.shiftId) conditions.push(eq(attendance.shiftId, f.shiftId));
    if (f.day) {
      conditions.push(sql`extract(day from ${attendance.date})::int = ${f.day}`);
    }
    if (f.departmentId) {
      conditions.push(
        exists(
          this.db
            .select({ id: memberDepartments.id })
            .from(memberDepartments)
            .where(
              and(
                eq(memberDepartments.memberId, attendance.memberId),
                eq(memberDepartments.departmentId, f.departmentId),
                // Since year and month filter are implicitly handled by the bounds (first, last),
                // it is safe to just use the existence check. Or we can pass year and month here if needed.
              ),
            ),
        ),
      );
    }

    return this.db
      .select({
        member_id: attendance.memberId,
        date: attendance.date,
        shift_id: attendance.shiftId,
        check_in_at: attendance.checkInAt,
        status: attendance.status,
        branch_id: attendance.branchId,
        group_id: members.groupId,
      })
      .from(attendance)
      .innerJoin(members, eq(members.id, attendance.memberId))
      .where(and(...conditions));
  }

  async getStatsRoster(
    first: string,
    last: string,
    f: { branchId?: string | null; groupId?: string | null; shiftId?: string | null; day?: number | null; departmentId?: string | null },
  ) {
    const conditions = [between(rosterDays.date, first, last)];
    if (f.branchId) conditions.push(eq(members.branchId, f.branchId));
    if (f.groupId) conditions.push(eq(members.groupId, f.groupId));
    if (f.shiftId) conditions.push(eq(rosterDays.shiftId, f.shiftId));
    if (f.day) {
      conditions.push(sql`extract(day from ${rosterDays.date})::int = ${f.day}`);
    }
    if (f.departmentId) {
      conditions.push(
        exists(
          this.db
            .select({ id: memberDepartments.id })
            .from(memberDepartments)
            .where(
              and(
                eq(memberDepartments.memberId, rosterDays.memberId),
                eq(memberDepartments.departmentId, f.departmentId),
              ),
            ),
        ),
      );
    }

    return this.db
      .select({
        member_id: rosterDays.memberId,
        date: rosterDays.date,
        shift_id: rosterDays.shiftId,
        branch_id: members.branchId,
        group_id: members.groupId,
        done: sql<boolean>`public.slot_concluded(${rosterDays.date}, ${rosterDays.shiftId})`,
      })
      .from(rosterDays)
      .innerJoin(members, eq(members.id, rosterDays.memberId))
      .where(and(...conditions));
  }

  async getProbesBetween(memberIds: string[], from: string, to: string) {
    if (!memberIds.length) return [];
    
    const checkInProbes = this.db
      .select({
        member_id: attendance.memberId,
        date: attendance.date,
        shift_name: attendance.shiftName,
        type: sql<string>`'check_in'`.as('type'),
        path: attendance.checkInProbePath,
        at: attendance.checkInAt,
        face_score: attendance.checkInFaceScore,
      })
      .from(attendance)
      .where(
        and(
          inArray(attendance.memberId, memberIds),
          between(attendance.date, from, to),
          isNotNull(attendance.checkInProbePath),
        ),
      );

    const checkOutProbes = this.db
      .select({
        member_id: attendance.memberId,
        date: attendance.date,
        shift_name: attendance.shiftName,
        type: sql<string>`'check_out'`.as('type'),
        path: attendance.checkOutProbePath,
        at: attendance.checkOutAt,
        face_score: attendance.checkOutFaceScore,
      })
      .from(attendance)
      .where(
        and(
          inArray(attendance.memberId, memberIds),
          between(attendance.date, from, to),
          isNotNull(attendance.checkOutProbePath),
        ),
      );

    // Drizzle union All
    const allProbes = await this.db
      .select()
      .from(checkInProbes.unionAll(checkOutProbes).as('p'))
      .orderBy(desc(sql`p.date`), asc(sql`p.type`));
      
    return allProbes;
  }

  async getAllProbePaths() {
    const checkInProbes = this.db
      .select({ path: attendance.checkInProbePath })
      .from(attendance)
      .where(isNotNull(attendance.checkInProbePath));

    const checkOutProbes = this.db
      .select({ path: attendance.checkOutProbePath })
      .from(attendance)
      .where(isNotNull(attendance.checkOutProbePath));

    const rows = await this.db
      .select()
      .from(checkInProbes.unionAll(checkOutProbes).as('p'));

    return rows.map((r) => r.path as string);
  }
}
