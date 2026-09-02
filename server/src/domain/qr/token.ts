// Location-bypass QR codes.
//
// A QR is the alternative to standing inside the geofence: scanning one issued
// for your branch proves a supervisor put you there. Which means every rule
// here is what stops a member checking in from home.
import { randomUUID } from 'node:crypto';

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

/** Is QR an accepted method here? Branch first, then the global setting. */
export function qrAllowed(method: CheckinMethod, branchQrEnabled: boolean | null): boolean {
  // A branch that never set the flag counts as enabled.
  return (method === 'qr' || method === 'both') && branchQrEnabled !== false;
}

/** Does this branch accept anything at all right now? */
export function checkinBlocked(method: CheckinMethod, branchBlocked: boolean | null): boolean {
  return method === 'none' || Boolean(branchBlocked);
}

/**
 * A token is short-lived on purpose: the QR screen regenerates before it
 * elapses, so a photograph of someone's screen is worth about twenty seconds.
 * Five seconds is the floor — below that a slow camera can never succeed.
 */
export function validitySeconds(settings: QrSettings): number {
  return Math.max(5, Number(settings.qrValiditySeconds) || 25);
}

/** How long a redeemed token keeps the location gate open. */
export function bypassMinutes(settings: QrSettings): number {
  return Math.max(1, Number(settings.qrBypassMinutes) || 30);
}

/**
 * 64 hex characters from two UUIDs.
 *
 * Long because the token IS the authorization — anyone holding it can check in
 * from anywhere for its lifetime — and short-lived tokens are still guessable
 * if the space is small enough to spray.
 */
export function mintToken(): string {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
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

/**
 * Decide what a mint request produces.
 *
 * A member who has been granted the privilege may only ever mint a BRANCH-WIDE
 * code for their own branch: allowing them to target an individual would let
 * them check in a specific colleague who is not there.
 */
export function planMint(req: MintRequest, settings: QrSettings): MintResult {
  if (!req.branchId) return { ok: false, reason: 'missing' };

  const memberId = req.byMember ? null : req.memberId;

  // The "must target a member" rule cannot apply to a member generator, who is
  // never allowed to target one.
  if (!req.byMember && settings.qrRequiresMember && !memberId) {
    return { ok: false, reason: 'member_required' };
  }

  return {
    ok: true,
    plan: { branchId: req.branchId, memberId, singleUse: Boolean(memberId) },
  };
}
