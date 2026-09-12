import type { Caller } from '../../../common/types.js';
import type { IGenericRepository } from '../../../infrastructure/database/interfaces/generic-repository.interface.js';
import { presenceChecks } from '../../../infrastructure/database/schema/index.js';
import type {
  CreatePresenceCheckDto,
  PresenceChecksResponseDto,
  ResolveCheckResponseDto,
  PendingPresenceResponseDto,
  PresenceCheckRowDto,
} from '../dto/presence.dto.js';

export interface IPresenceService {
  createCheck(
    caller: Caller,
    b: CreatePresenceCheckDto,
  ): Promise<{ ok: boolean; check: typeof presenceChecks.$inferSelect; target_count: number }>;
  getChecks(callerId: string): Promise<PresenceChecksResponseDto>;
  deleteCheck(callerId: string, id: string): Promise<void>;
  confirmByAdmin(callerId: string, id: string, memberId: string): Promise<{ ok: boolean }>;
  resolveCheck(callerId: string, id: string, decision: string): Promise<ResolveCheckResponseDto>;
  getPending(callerId: string): Promise<PendingPresenceResponseDto>;
  confirmByMember(callerId: string, checkId: string): Promise<{ ok: boolean }>;
}

export interface IPresenceRepository extends IGenericRepository<typeof presenceChecks> {
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
