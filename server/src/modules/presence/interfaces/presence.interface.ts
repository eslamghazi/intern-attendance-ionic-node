import type { Caller } from '../../../common/types.js';
import type { IGenericRepository } from '../../../common/database/interfaces/generic-repository.interface.js';
import { presenceChecks } from '../../../db/schema/index.js';

export interface IPresenceService {
  createCheck(
    caller: Caller,
    b: {
      branch_id?: string | null;
      group_id?: string | null;
      department_id?: string | null;
      shift_id?: string | null;
      deadline_minutes: number;
    },
  ): Promise<{ ok: boolean; check: any; target_count: number }>;
  getChecks(callerId: string): Promise<{ checks: any[] }>;
  deleteCheck(callerId: string, id: string): Promise<void>;
  confirmByAdmin(callerId: string, id: string, memberId: string): Promise<{ ok: boolean }>;
  resolveCheck(callerId: string, id: string, decision: string): Promise<{ ok: boolean; decision: string }>;
  getPending(callerId: string): Promise<{ pending: any }>;
  confirmByMember(callerId: string, checkId: string): Promise<{ ok: boolean }>;
}

export interface IPresenceRepository extends IGenericRepository<
  typeof presenceChecks.$inferSelect,
  string,
  typeof presenceChecks.$inferInsert,
  Partial<typeof presenceChecks.$inferInsert>
> {
  getOwnedCheck(checkId: string, callerId: string): Promise<any>;
  getCheck(checkId: string): Promise<any>;
  findActiveTargets(
    dates: string[],
    branchId: string | null,
    groupId: string | null,
    departmentId: string | null,
    year: number,
    month: number,
  ): Promise<string[]>;
  createCheck(data: {
    createdBy: string;
    branchId: string | null;
    groupId: string | null;
    departmentId: string | null;
    shiftId: string | null;
    date: string;
    deadline: string;
    targetMemberIds: string[];
  }): Promise<any>;
  getRecentChecks(callerId: string, limit?: number): Promise<any[]>;
  getProfilesForMembers(memberIds: string[]): Promise<Array<{ memberId: string; fullName: string }>>;
  getConfirmationsForChecks(checkIds: string[]): Promise<Array<{ checkId: string; memberId: string }>>;
  deleteCheck(id: string): Promise<void>;
  confirmCheck(checkId: string, memberId: string): Promise<void>;
  resolveLeftWork(checkId: string, checkDate: string, checkShiftId: string | null, targetIds: string[]): Promise<void>;
  markCheckResolved(id: string, decision: string): Promise<void>;
  getMemberIdByProfileId(profileId: string): Promise<string | null>;
  getPendingCheckForMember(memberId: string): Promise<{ check_id: string; deadline: string } | null>;
}
