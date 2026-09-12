// What a QR token is minted from and answers with.

/** The app-wide check-in method, most restrictive of global and branch. */
export type CheckinMethod = 'both' | 'location' | 'qr' | 'none';

export interface QrSettings {
  checkinMethod: CheckinMethod;
  /** Every token must name one member; branch-wide codes are refused. */
  qrRequiresMember: boolean;
  /** Seconds a token stays valid. */
  qrValiditySeconds: number | null;
  /** Minutes a redeemed token opens the location gate for. */
  qrBypassMinutes: number | null;
}

export interface MintRequest {
  /** True when a MEMBER is generating, rather than staff. */
  byMember: boolean;
  /** The branch the caller may mint for. */
  branchId: string | null;
  /** The member a staff-issued token is restricted to. */
  memberId: string | null;
}

export interface MintPlan {
  branchId: string;
  memberId: string | null;
  /** A member-specific token is one-time; a branch-wide one is reusable while
   *  it lives, because a supervisor shows it to a queue of people. */
  singleUse: boolean;
}

export type MintResult =
  | { ok: true; plan: MintPlan }
  | { ok: false; reason: 'missing' | 'member_required' };
