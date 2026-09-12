import type { JwtClaims } from '../../../infrastructure/database/context.js';
import type { Caller } from '../../../common/types.js';
import type { IGenericRepository } from '../../../infrastructure/database/interfaces/generic-repository.interface.js';
import { attendance } from '../../../infrastructure/database/schema/index.js';
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
import type { AttendanceHistoryRow } from '../reports.types.js';

export type StatsFilter = {
  branchId?: string | null;
  groupId?: string | null;
  shiftId?: string | null;
  day?: number | null;
  departmentId?: string | null;
};

export interface IReportsService {
  getPresent(caller: Caller, dates: string[]): Promise<PresentMemberRowDto[]>;
  getReview(caller: Caller, date: string, branchId?: string | null): Promise<ReviewAttendanceItemDto[]>;
  // These three are reachable by a MEMBER, so they take the caller and refuse
  // a member_id that is not their own — see requireSelfOrMember.
  getDetail(caller: Caller, memberId: string, date: string, shiftId?: string | null): Promise<DetailAttendanceItemDto | null>;
  getHistory(caller: Caller, memberId: string, year?: number, month?: number): Promise<AttendanceHistoryEntryDto[]>;
  getDay(caller: Caller, memberId: string, date: string): Promise<DayAttendanceResultDto>;
  getDailyRoster(caller: Caller, date: string, branchId?: string | null): Promise<DailyRosterItemDto[]>;
  getMonthly(caller: Caller, filters: MemberFilters, year: number, month: number, page: number, pageSize: number): Promise<{ rows: MonthlyAttendanceRowDto[]; total: number }>;
  getReport(caller: Caller, from: string, to: string, branchId?: string | null, groupId?: string | null): Promise<any[]>;
  getToday(caller: Caller, date: string): Promise<TodaySummaryDto[]>;
  getStats(caller: Caller, year: number,
    month: number,
    f: StatsFilter,
  ): Promise<StatsSummaryDto>;
  getProbes(memberIds: string[], from: string, to: string): Promise<ProbeItemDto[]>;
  getProbePaths(): Promise<string[]>;
}

export interface IReportsRepository extends IGenericRepository<typeof attendance> {
  getPresent(dates: string[]): Promise<PresentMemberRowDto[]>;
  getReview(date: string, branchId?: string | null): Promise<Array<{ attendance: typeof attendance.$inferSelect; profile_full_name: string; profile_national_id: string }>>;
  getDetail(memberId: string, date: string, shiftId?: string | null): Promise<{ attendance: typeof attendance.$inferSelect; profile_full_name: string; profile_national_id: string } | null>;
  getAttendanceHistorySimple(memberId: string): Promise<AttendanceHistoryRow[]>;
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
