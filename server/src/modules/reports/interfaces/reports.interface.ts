import type { JwtClaims } from '../../../db/context.js';
import type { IGenericRepository } from '../../../common/database/interfaces/generic-repository.interface.js';
import { attendance } from '../../../db/schema/index.js';

export interface IReportsService {
  getPresent(claims: JwtClaims, dates: string[]): Promise<any[]>;
  getReview(claims: JwtClaims, date: string, branchId?: string | null): Promise<any[]>;
  getDetail(claims: JwtClaims, memberId: string, date: string, shiftId?: string | null): Promise<any>;
  getHistory(claims: JwtClaims, memberId: string, year?: number, month?: number): Promise<any[]>;
  getDay(claims: JwtClaims, memberId: string, date: string): Promise<{ shifts: any[]; attendance: any[] }>;
  getDailyRoster(claims: JwtClaims, date: string, branchId?: string | null): Promise<any[]>;
  getMonthly(claims: JwtClaims, filters: any, year: number, month: number, page: number, pageSize: number): Promise<{ rows: any[]; total: number }>;
  getReport(claims: JwtClaims, from: string, to: string, branchId?: string | null, groupId?: string | null): Promise<any[]>;
  getToday(claims: JwtClaims, date: string): Promise<any[]>;
  getStats(
    claims: JwtClaims,
    year: number,
    month: number,
    f: { branchId?: string | null; groupId?: string | null; shiftId?: string | null; day?: number | null; departmentId?: string | null },
  ): Promise<any>;
  getProbes(claims: JwtClaims, memberIds: string[], from: string, to: string): Promise<any[]>;
  getProbePaths(claims: JwtClaims): Promise<string[]>;
}

export interface IReportsRepository extends IGenericRepository<
  typeof attendance.$inferSelect,
  string,
  typeof attendance.$inferInsert,
  Partial<typeof attendance.$inferInsert>
> {
  getPresent(dates: string[]): Promise<any[]>;
  getReview(date: string, branchId?: string | null): Promise<any[]>;
  getDetail(memberId: string, date: string, shiftId?: string | null): Promise<any>;
  getAttendanceHistorySimple(memberId: string): Promise<any[]>;
  getRosterBetween(memberId: string, first: string, last: string): Promise<any[]>;
  getAttendanceBetween(memberId: string, first: string, last: string): Promise<any[]>;
  getRosterDayWithShift(memberId: string, date: string): Promise<any[]>;
  getAttendanceDayWithShift(memberId: string, date: string): Promise<any[]>;
  getDailyExpected(date: string, branchId?: string | null): Promise<any[]>;
  getDailyAttendance(date: string, branchId?: string | null): Promise<any[]>;
  getMemberDirectoryPage(filters: any, year: number, month: number, pageSize: number, offset: number): Promise<any[]>;
  getMemberDirectoryCount(filters: any, year: number, month: number): Promise<number>;
  getRosterForMembersBetween(memberIds: string[], first: string, last: string): Promise<any[]>;
  getAttendanceForMembersBetween(memberIds: string[], first: string, last: string): Promise<any[]>;
  getReportAttendanceBetween(from: string, to: string, branchId?: string | null, groupId?: string | null): Promise<any[]>;
  getTodayAttendance(date: string): Promise<any[]>;
  getStatsAttendance(first: string, last: string, f: any): Promise<any[]>;
  getStatsRoster(first: string, last: string, f: any): Promise<any[]>;
  getProbesBetween(memberIds: string[], from: string, to: string): Promise<any[]>;
  getAllProbePaths(): Promise<string[]>;
}
