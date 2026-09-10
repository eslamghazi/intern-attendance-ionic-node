import type { Caller } from '../../../domain/identity/role.js';
import type { IGenericRepository } from '../../../common/database/interfaces/generic-repository.interface.js';
import { rosterDays } from '../../../db/schema/index.js';
import type {
  RosterViewRowDto,
  RosterMakerMemberDto,
  RosterMakerShiftDto,
  RosterMakerScheduleDto,
  BulkRosterDto,
  BulkRosterResultDto,
} from '../dto/roster.dto.js';
import type { MemberFilters } from '../../../domain/member/filter.js';
import type { BulkPlan } from '../../../domain/roster/bulk.js';

export interface IRosterService {
  getRosterView(
    caller: Caller,
    filters: MemberFilters,
    year: number,
    month: number,
    pageSize: number,
    offset: number,
  ): Promise<{ rows: RosterViewRowDto[]; total: number }>;
  getRosterTotals(
    caller: Caller,
    filters: MemberFilters,
    year: number,
    month: number,
  ): Promise<{ perDay: Record<number, number>; perDayShift: Record<number, Record<string, number>>; total: number }>;
  getMakerData(caller: Caller, year: number, month: number): Promise<{
    members: RosterMakerMemberDto[];
    shifts: RosterMakerShiftDto[];
    roster: RosterMakerScheduleDto[];
  }>;
  getExistingKeys(caller: Caller, year: number, month: number, memberIds: string[]): Promise<string[]>;
  postRosterDays(caller: Caller, days: { member_id: string; date: string; shift_id: string }[]): Promise<{ affected: number }>;
  deleteRosterDays(caller: Caller, d: { member_id: string; date: string; shift_id: string }): Promise<void>;
  bulkRoster(caller: Caller, o: BulkRosterDto): Promise<BulkRosterResultDto>;
}

export interface IRosterRepository extends IGenericRepository<
  typeof rosterDays.$inferSelect,
  string,
  typeof rosterDays.$inferInsert,
  Partial<typeof rosterDays.$inferInsert>
> {
  getRosterView(
    filters: MemberFilters,
    year: number,
    month: number,
    first: string,
    last: string,
    pageSize: number,
    offset: number,
  ): Promise<{ rows: RosterViewRowDto[]; total: number }>;
  getRosterTotals(
    filters: MemberFilters,
    year: number,
    month: number,
    first: string,
    last: string,
  ): Promise<{ perDay: Record<number, number>; perDayShift: Record<number, Record<string, number>>; total: number }>;
  getMakerSelf(callerId: string): Promise<{ branch_id: string; can_make_roster: boolean } | null>;
  getMakerMembers(branchId: string): Promise<RosterMakerMemberDto[]>;
  getMakerShifts(): Promise<RosterMakerShiftDto[]>;
  getMakerRoster(branchId: string, first: string, last: string): Promise<RosterMakerScheduleDto[]>;
  getExistingKeys(memberIds: string[], first: string, last: string): Promise<string[]>;
  bulkOperation(o: BulkRosterDto, first: string, last: string, dates: string[], plan: BulkPlan): Promise<BulkRosterResultDto>;
  insertDays(insertValues: { memberId: string; date: string; shiftId: string }[]): Promise<number>;
  deleteDay(memberId: string, date: string, shiftId: string): Promise<void>;
}
