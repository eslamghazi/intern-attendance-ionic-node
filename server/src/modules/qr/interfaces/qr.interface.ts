import type { Caller } from '../../../common/types.js';
import type { IGenericRepository } from '../../../common/database/interfaces/generic-repository.interface.js';
import { qrTokens } from '../../../db/schema/index.js';

export interface IQrService {
  mintQr(
    caller: Caller,
    parsed: { branch_id?: string; date: string; member_id?: string | null },
  ): Promise<{ ok: boolean; token: string; date: string; validity_seconds: number }>;
  redeemQr(caller: Caller, tokenCode: string): Promise<{ ok: boolean; until?: string | null; minutes: number }>;
}

export interface IQrRepository extends IGenericRepository<
  typeof qrTokens.$inferSelect,
  string,
  typeof qrTokens.$inferInsert,
  Partial<typeof qrTokens.$inferInsert>
> {
  getSettings(): Promise<{
    qr_requires_member: boolean | null;
    qr_validity_seconds: number | null;
    qr_bypass_minutes: number | null;
    checkin_method: string | null;
  }>;
  getMemberByProfileId(profileId: string): Promise<{
    branch_id: string | null;
    can_generate_qr: boolean | null;
  } | null>;
  getBranchQrEnabled(branchId: string): Promise<boolean | null>;
  deleteExpiredTokens(): Promise<void>;
  insertToken(data: {
    token: string;
    branchId: string;
    date: string;
    memberId: string | null;
    singleUse: boolean;
    expiresAt: string;
    createdBy: string;
  }): Promise<void>;
  getMemberWithBranch(profileId: string): Promise<{
    id: string;
    branch_id: string | null;
    qr_enabled: boolean | null;
    block_checkin: boolean | null;
  } | null>;
  getValidToken(
    token: string,
    branchId: string,
    date: string,
    memberId: string,
    qrRequiresMember: boolean,
  ): Promise<{ id: string; single_use: boolean } | null>;
  markTokenUsed(id: string): Promise<void>;
  updateMemberBypass(memberId: string, bypassUntil: string): Promise<{ locationBypassUntil: string | null } | null>;
}
