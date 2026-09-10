import type { JwtClaims } from '../../../db/context.js';
import type { IGenericRepository } from '../../../common/database/interfaces/generic-repository.interface.js';
import { attendance } from '../../../db/schema/index.js';
import type {
  PresentMemberRowDto,
  ReviewAttendanceItemDto,
  DetailAttendanceItemDto,
  AttendanceHistoryEntryDto,
  DayAttendanceResultDto,
  DailyRosterItemDto,
  TodaySummaryDto,
  StatsSummaryDto,
  ProbeItemDto,
  MonthlyAttendanceRowDto,
} from '../dto/reports.dto.js';

import type { MemberFilters } from '../../../domain/member/filter.js';

export type StatsFilter = {
  branchId?: string | null;
  groupId?: string | null;
  shiftId?: string | null;
  day?: number | null;
  departmentId?: string | null;
};

export interface IReportsService {
  getPresent(claims: JwtClaims, dates: string[]): Promise<PresentMemberRowDto[]>;
  getReview(claims: JwtClaims, date: string, branchId?: string | null): Promise<ReviewAttendanceItemDto[]>;
  getDetail(claims: JwtClaims, memberId: string, date: string, shiftId?: string | null): Promise<DetailAttendanceItemDto | null>;
  getHistory(claims: JwtClaims, memberId: string, year?: number, month?: number): Promise<AttendanceHistoryEntryDto[]>;
  getDay(claims: JwtClaims, memberId: string, date: string): Promise<DayAttendanceResultDto>;
  getDailyRoster(claims: JwtClaims, date: string, branchId?: string | null): Promise<DailyRosterItemDto[]>;
  getMonthly(claims: JwtClaims, filters: MemberFilters, year: number, month: number, page: number, pageSize: number): Promise<{ rows: MonthlyAttendanceRowDto[]; total: number }>;
  getReport(claims: JwtClaims, from: string, to: string, branchId?: string | null, groupId?: string | null): Promise<any[]>;
  getToday(claims: JwtClaims, date: string): Promise<TodaySummaryDto[]>;
  getStats(
    claims: JwtClaims,
    year: number,
    month: number,
    f: StatsFilter,
  ): Promise<StatsSummaryDto>;
  getProbes(claims: JwtClaims, memberIds: string[], from: string, to: string): Promise<ProbeItemDto[]>;
  getProbePaths(claims: JwtClaims): Promise<string[]>;
}

export interface IReportsRepository extends IGenericRepository<
  typeof attendance.$inferSelect,
  string,
  typeof attendance.$inferInsert,
  Partial<typeof attendance.$inferInsert>
> {
  getPresent(dates: string[]): Promise<PresentMemberRowDto[]>;
  getReview(date: string, branchId?: string | null): Promise<Array<{ attendance: typeof attendance.$inferSelect; profile_full_name: string; profile_national_id: string }>>;
  getDetail(memberId: string, date: string, shiftId?: string | null): Promise<{ attendance: typeof attendance.$inferSelect; profile_full_name: string; profile_national_id: string } | null>;
  getAttendanceHistorySimple(memberId: string): Promise<AttendanceHistoryEntryDto[]>;
  getRosterBetween(memberId: string, first: string, last: string): Promise<any[]>;
  getAttendanceBetween(memberId: string, first: string, last: string): Promise<any[]>;
  getRosterDayWithShift(memberId: string, date: string): Promise<any[]>;
  getAttendanceDayWithShift(memberId: string, date: string): Promise<any[]>;
  getDailyExpected(date: string, branchId?: string | null): Promise<any[]>;
  getDailyAttendance(date: string, branchId?: string | null): Promise<any[]>;
  getMemberDirectoryPage(filters: MemberFilters, year: number, month: number, pageSize: number, offset: number): Promise<any[]>;
  getMemberDirectoryCount(filters: MemberFilters, year: number, month: number): Promise<number>;
  getRosterForMembersBetween(memberIds: string[], first: string, last: string): Promise<any[]>;
  getAttendanceForMembersBetween(memberIds: string[], first: string, last: string): Promise<any[]>;
  getReportAttendanceBetween(from: string, to: string, branchId?: string | null, groupId?: string | null): Promise<any[]>;
  getTodayAttendance(date: string): Promise<any[]>;
  getStatsAttendance(first: string, last: string, f: StatsFilter): Promise<any[]>;
  getStatsRoster(first: string, last: string, f: StatsFilter): Promise<any[]>;
  getProbesBetween(memberIds: string[], from: string, to: string): Promise<ProbeItemDto[]>;
  getAllProbePaths(): Promise<string[]>;
}
