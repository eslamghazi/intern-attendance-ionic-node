import type { Caller } from '../../../domain/identity/role.js';
import type { IGenericRepository } from '../../../common/database/interfaces/generic-repository.interface.js';
import { rosterDays } from '../../../db/schema/index.js';

export interface IRosterService {
  getRosterView(
    caller: Caller,
    filters: any,
    year: number,
    month: number,
    pageSize: number,
    offset: number,
  ): Promise<{ rows: any[]; total: number }>;
  getRosterTotals(
    caller: Caller,
    filters: any,
    year: number,
    month: number,
  ): Promise<{ perDay: Record<number, number>; perDayShift: Record<number, Record<string, number>>; total: number }>;
  getMakerData(caller: Caller, year: number, month: number): Promise<{ members: any[]; shifts: any[]; roster: any[] }>;
  getExistingKeys(caller: Caller, year: number, month: number, memberIds: string[]): Promise<string[]>;
  postRosterDays(caller: Caller, days: { member_id: string; date: string; shift_id: string }[]): Promise<{ affected: number }>;
  deleteRosterDays(caller: Caller, d: { member_id: string; date: string; shift_id: string }): Promise<void>;
  bulkRoster(caller: Caller, o: any): Promise<{ members: number; added: number; removed: number }>;
}

export interface IRosterRepository extends IGenericRepository<
  typeof rosterDays.$inferSelect,
  string,
  typeof rosterDays.$inferInsert,
  Partial<typeof rosterDays.$inferInsert>
> {
  getRosterView(
    filters: any,
    year: number,
    month: number,
    first: string,
    last: string,
    pageSize: number,
    offset: number,
  ): Promise<{ rows: any[]; total: number }>;
  getRosterTotals(
    filters: any,
    year: number,
    month: number,
    first: string,
    last: string,
  ): Promise<{ perDay: Record<number, number>; perDayShift: Record<number, Record<string, number>>; total: number }>;
  getMakerSelf(callerId: string): Promise<{ branch_id: string; can_make_roster: boolean } | null>;
  getMakerMembers(branchId: string): Promise<any[]>;
  getMakerShifts(): Promise<any[]>;
  getMakerRoster(branchId: string, first: string, last: string): Promise<any[]>;
  getExistingKeys(memberIds: string[], first: string, last: string): Promise<string[]>;
  bulkOperation(o: any, first: string, last: string, dates: string[], plan: any): Promise<{ members: number; added: number; removed: number }>;
  insertDays(insertValues: any[]): Promise<number>;
  deleteDay(memberId: string, date: string, shiftId: string): Promise<void>;
}
