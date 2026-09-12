import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../infrastructure/database/generic.repository.js';
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
  appSettings,
} from '../../infrastructure/database/schema/index.js';
import { cairoNow } from '../../domain/clock.js';
import { slotConcluded } from '../../domain/attendance/slotConcluded.js';
import type { ShiftRow } from '../../domain/attendance/windows.js';
import {
  eq,
  count,
  inArray,
  isNull,
  isNotNull,
  and,
  or,
  desc,
  asc,
  notExists,
  between,
  exists,
  sql,
  type SQL,
} from 'drizzle-orm';
import { dayInMonth, directoryWhere } from '../../domain/member/filter.js';
import { CheckType } from '../../common/enums/index.js';

import type { IReportsRepository } from './interfaces/reports.interface.js';


/**
 * The caller's reach, as a condition over the joined `members` row.
 *
 * `undefined` leaves the query unrestricted — a superadmin. An EMPTY reach is
 * not the same thing: it means this caller reaches nothing, and must match no
 * rows rather than all of them.
 *
 * Applied in SQL rather than to the rows afterwards, because these feed counts
 * and aggregates: a result filtered after the fact would disagree with the
 * total computed beside it.
 */
export type Reach = { branchIds: readonly string[]; groupIds: readonly string[] } | undefined;

function reachCondition(scope: Reach): SQL | undefined {
  if (!scope) return undefined;
  const reach: SQL[] = [];
  if (scope.branchIds.length) reach.push(inArray(members.branchId, [...scope.branchIds]));
  if (scope.groupIds.length) reach.push(inArray(members.groupId, [...scope.groupIds]));
  return reach.length ? or(...reach)! : sql`false`;
}

@Injectable()
export class ReportsRepository extends GenericRepository<typeof attendance> implements IReportsRepository {

  /**
   * Everything slotConcluded() needs, fetched once per call.
   *
   * `done` is decided by domain/attendance/slotConcluded.ts, which needs the
   * row's shift and two global defaults.
   *
   * Two reads, not one per row: the settings row, and the whole shifts table —
   * which is a handful of rows a faculty edits a few times a year, so a Map is
   * cheaper than joining it into four queries and carrying six more columns
   * through each.
   */
  private async slotContext() {
    const settingsRows = await this.db
      .select({
        enforce: appSettings.enforceShiftWindow,
        shiftStart: appSettings.shiftStart,
        shiftEnd: appSettings.shiftEnd,
      })
      .from(appSettings)
      .where(eq(appSettings.id, 1))
      .limit(1);
    const settings = settingsRows[0];

    const shiftRows = await this.db
      .select({
        id: shifts.id,
        name: shifts.name,
        checkin_open: shifts.checkinOpen,
        checkin_late: shifts.checkinLate,
        checkin_close: shifts.checkinClose,
        checkout_open: shifts.checkoutOpen,
        checkout_close: shifts.checkoutClose,
        start_time: shifts.startTime,
        end_time: shifts.endTime,
      })
      .from(shifts);

    return {
      // Absent settings row means enforce, matching `coalesce(..., true)`.
      enforceShiftWindow: settings?.enforce !== false,
      defaults: { shiftStart: settings?.shiftStart ?? null, shiftEnd: settings?.shiftEnd ?? null },
      clock: cairoNow(),
      byId: new Map<string, ShiftRow>(shiftRows.map((r) => [r.id, r as ShiftRow])),
    };
  }

  /** Attach `done` to rows that carry a date and a shift id. */
  private withDone<T extends { date: string; shift_id: string | null }>(
    rows: T[],
    ctx: Awaited<ReturnType<ReportsRepository['slotContext']>>,
  ): (T & { done: boolean })[] {
    return rows.map((r) => ({
      ...r,
      done: slotConcluded({
        date: r.date,
        shift: r.shift_id ? ctx.byId.get(r.shift_id) ?? null : null,
        enforceShiftWindow: ctx.enforceShiftWindow,
        defaults: ctx.defaults,
        clock: ctx.clock,
      }),
    }));
  }
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

  async getReview(date: string, branchId?: string | null, scope?: Reach) {
    const conditions = [eq(attendance.date, date)];
    if (branchId) conditions.push(eq(attendance.branchId, branchId));
    const reach = reachCondition(scope);
    if (reach) conditions.push(reach);


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
    const ctx = await this.slotContext();
    const rows = await this.db
      .select({
        date: rosterDays.date,
        shift_id: rosterDays.shiftId,
        shift_name: shifts.name,
      })
      .from(rosterDays)
      .leftJoin(shifts, eq(shifts.id, rosterDays.shiftId))
      .where(
        and(
          eq(rosterDays.memberId, memberId),
          between(rosterDays.date, first, last),
        ),
      );
    return this.withDone(rows, ctx);
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

  async getDailyExpected(date: string, branchId?: string | null, scope?: Reach) {
    const conditions = [eq(rosterDays.date, date)];
    if (branchId) conditions.push(eq(members.branchId, branchId));
    const reach = reachCondition(scope);
    if (reach) conditions.push(reach);


    const ctx = await this.slotContext();
    const rows = await this.db
      .select({
        member_id: rosterDays.memberId,
        date: rosterDays.date,
        shift_id: rosterDays.shiftId,
        shift: shifts,
        full_name: profiles.fullName,
        national_id: profiles.nationalId,
      })
      .from(rosterDays)
      .innerJoin(members, eq(members.id, rosterDays.memberId))
      .innerJoin(profiles, eq(profiles.id, members.profileId))
      .leftJoin(shifts, eq(shifts.id, rosterDays.shiftId))
      .where(and(...conditions));
    return this.withDone(rows, ctx);
  }

  async getDailyAttendance(date: string, branchId?: string | null, scope?: Reach) {
    const conditions = [eq(attendance.date, date)];
    if (branchId) conditions.push(eq(attendance.branchId, branchId));
    const reach = reachCondition(scope);
    if (reach) conditions.push(reach);


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

  /**
   * A page of the filtered directory, or ALL of it.
   *
   * `pageSize === null` means no limit, which is what an export asks for: the
   * report is "every member the filter matched", and a paged export is a client
   * stitching pages together and hoping nothing moved between two of them.
   *
   * Same predicate and same ordering either way, so a file and the grid behind
   * it can never disagree about what the filter meant.
   */
  async getMemberDirectoryPage(
    filters: any,
    year: number,
    month: number,
    pageSize: number | null,
    offset: number,
  ) {
    const q = this.db
      .select({
        member_id: memberDirectory.memberId,
        full_name: memberDirectory.fullName,
        national_id: memberDirectory.nationalId,
      })
      .from(memberDirectory)
      .where(directoryWhere({ ...filters, year, month }))
      .orderBy(asc(memberDirectory.fullName), asc(memberDirectory.memberId));

    return pageSize === null ? q : q.limit(pageSize).offset(offset);
  }

  async getMemberDirectoryCount(filters: any, year: number, month: number) {
    const rows = await this.db
      .select({ count: count() })
      .from(memberDirectory)
      .where(directoryWhere({ ...filters, year, month }));
    return Number(rows[0]?.count ?? 0);
  }

  async getRosterForMembersBetween(memberIds: string[], first: string, last: string) {
    if (!memberIds.length) return [];
    const ctx = await this.slotContext();
    const rows = await this.db
      .select({
        member_id: rosterDays.memberId,
        date: rosterDays.date,
        shift_id: rosterDays.shiftId,
      })
      .from(rosterDays)
      .where(
        and(
          inArray(rosterDays.memberId, memberIds),
          between(rosterDays.date, first, last),
        ),
      );
    return this.withDone(rows, ctx);
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

  async getReportAttendanceBetween(from: string, to: string, branchId?: string | null, groupId?: string | null, scope?: Reach) {
    const conditions = [between(attendance.date, from, to)];
    if (branchId) conditions.push(eq(attendance.branchId, branchId));
    if (groupId) conditions.push(eq(members.groupId, groupId));
    const reach = reachCondition(scope);
    if (reach) conditions.push(reach);


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
    scope?: Reach,
  ) {
    const conditions = [between(attendance.date, first, last)];
    if (f.branchId) conditions.push(eq(attendance.branchId, f.branchId));
    const reach = reachCondition(scope);
    if (reach) conditions.push(reach);

    if (f.groupId) conditions.push(eq(members.groupId, f.groupId));
    if (f.shiftId) conditions.push(eq(attendance.shiftId, f.shiftId));
    // `first` and `last` are always one month (domain/roster/bulk.monthBounds),
    // so "day N of that month" is a single date. Was
    // `extract(day from date)::int = N`, which had to be computed for every row
    // in the range because a function of a column cannot use its index; an
    // equality on the column itself can.
    if (f.day) conditions.push(eq(attendance.date, dayInMonth(first, f.day)));
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
    scope?: Reach,
  ) {
    const conditions = [between(rosterDays.date, first, last)];
    if (f.branchId) conditions.push(eq(members.branchId, f.branchId));
    const reach = reachCondition(scope);
    if (reach) conditions.push(reach);

    if (f.groupId) conditions.push(eq(members.groupId, f.groupId));
    if (f.shiftId) conditions.push(eq(rosterDays.shiftId, f.shiftId));
    // See getStatsAttendance: one month of bounds makes this an exact date.
    if (f.day) conditions.push(eq(rosterDays.date, dayInMonth(first, f.day)));
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

    const ctx = await this.slotContext();
    const rows = await this.db
      .select({
        member_id: rosterDays.memberId,
        date: rosterDays.date,
        shift_id: rosterDays.shiftId,
        branch_id: members.branchId,
        group_id: members.groupId,
      })
      .from(rosterDays)
      .innerJoin(members, eq(members.id, rosterDays.memberId))
      .where(and(...conditions));
    return this.withDone(rows, ctx);
  }

  /**
   * Every stored probe image for these members in a date range.
   *
   * A check-in and a check-out are two columns of ONE attendance row, so "one
   * probe per row" means splitting each row in two.
   *
   * Done here rather than as a UNION ALL in SQL: the rows travel to Node either
   * way — each becomes a signed URL — so the union would save nothing, and its
   * `type` column and ordering would both be strings no type describes.
   */
  async getProbesBetween(memberIds: string[], from: string, to: string) {
    if (!memberIds.length) return [];

    const inRange = and(
      inArray(attendance.memberId, memberIds),
      between(attendance.date, from, to),
    );

    const rows = await this.db
      .select({
        member_id: attendance.memberId,
        date: attendance.date,
        shift_name: attendance.shiftName,
        in_path: attendance.checkInProbePath,
        in_at: attendance.checkInAt,
        in_score: attendance.checkInFaceScore,
        out_path: attendance.checkOutProbePath,
        out_at: attendance.checkOutAt,
        out_score: attendance.checkOutFaceScore,
      })
      .from(attendance)
      .where(
        and(
          inRange,
          or(isNotNull(attendance.checkInProbePath), isNotNull(attendance.checkOutProbePath)),
        ),
      );

    const probes = rows.flatMap((r) => {
      const common = { member_id: r.member_id, date: r.date, shift_name: r.shift_name };
      const out = [];
      if (r.in_path) {
        out.push({ ...common, type: CheckType.CHECK_IN, path: r.in_path, at: r.in_at, face_score: r.in_score });
      }
      if (r.out_path) {
        out.push({ ...common, type: CheckType.CHECK_OUT, path: r.out_path, at: r.out_at, face_score: r.out_score });
      }
      return out;
    });

    // Was `order by p.date desc, p.type asc`. Same order, same reason: newest
    // day first, and a check-in listed before the check-out it belongs to.
    probes.sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type));
    return probes;
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
