// The refresh-token vocabulary.

/** The stored record, as the rule needs to see it. */
export interface StoredRefreshToken {
  profileId: string;
  familyId: string;
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

export type RefreshOutcome =
  /** Good. Issue a new pair and rotate this one. */
  | { kind: 'rotate' }
  /** No such token, or it is past its expiry. Sign in again. */
  | { kind: 'reject'; reason: 'unknown' | 'expired' | 'revoked' }
  /** Already exchanged once. A copy is loose — revoke the whole family. */
  | { kind: 'reuse'; familyId: string };
