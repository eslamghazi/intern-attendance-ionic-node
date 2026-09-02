import { describe, expect, it } from 'vitest';
import { classifyRefresh, expiresInSeconds, expiryFrom, type StoredRefreshToken } from './refresh.js';

const NOW = new Date('2026-09-01T12:00:00Z');
const FAMILY = 'ffffffff-0000-0000-0000-000000000001';

const token = (over: Partial<StoredRefreshToken> = {}): StoredRefreshToken => ({
  profileId: 'aaaaaaaa-0000-0000-0000-000000000001',
  familyId: FAMILY,
  expiresAt: new Date('2026-10-01T12:00:00Z'),
  rotatedAt: null,
  revokedAt: null,
  ...over,
});

describe('classifyRefresh', () => {
  it('rotates a live token', () => {
    expect(classifyRefresh(token(), NOW)).toEqual({ kind: 'rotate' });
  });

  it('rejects one it has never seen', () => {
    expect(classifyRefresh(null, NOW)).toEqual({ kind: 'reject', reason: 'unknown' });
  });

  it('rejects an expired token', () => {
    expect(classifyRefresh(token({ expiresAt: new Date('2026-08-31T12:00:00Z') }), NOW)).toEqual({
      kind: 'reject',
      reason: 'expired',
    });
  });

  it('treats the exact expiry instant as expired', () => {
    expect(classifyRefresh(token({ expiresAt: NOW }), NOW)).toEqual({
      kind: 'reject',
      reason: 'expired',
    });
  });

  it('rejects a revoked token', () => {
    expect(classifyRefresh(token({ revokedAt: NOW }), NOW)).toEqual({
      kind: 'reject',
      reason: 'revoked',
    });
  });

  it('flags a second use of an already-rotated token', () => {
    expect(classifyRefresh(token({ rotatedAt: NOW }), NOW)).toEqual({ kind: 'reuse', familyId: FAMILY });
  });

  it('flags reuse even once the replayed token has expired', () => {
    // The replay is evidence of a copy whatever the token's own state. Its
    // family may still hold living descendants, and those are what matter.
    expect(
      classifyRefresh(
        token({ rotatedAt: new Date('2026-08-01T12:00:00Z'), expiresAt: new Date('2026-08-31T12:00:00Z') }),
        NOW,
      ),
    ).toEqual({ kind: 'reuse', familyId: FAMILY });
  });

  it('flags reuse ahead of revocation', () => {
    // Revoking the family is strictly more than revoking the one token, so the
    // stronger answer has to win when both apply.
    expect(classifyRefresh(token({ rotatedAt: NOW, revokedAt: NOW }), NOW)).toEqual({
      kind: 'reuse',
      familyId: FAMILY,
    });
  });
});

describe('expiryFrom', () => {
  it('adds whole days', () => {
    expect(expiryFrom(NOW, 30).toISOString()).toBe('2026-10-01T12:00:00.000Z');
  });

  it('handles a fractional ttl', () => {
    expect(expiryFrom(NOW, 0.5).toISOString()).toBe('2026-09-02T00:00:00.000Z');
  });
});

describe('expiresInSeconds', () => {
  it('converts minutes to seconds', () => {
    expect(expiresInSeconds(15)).toBe(900);
  });

  it('never reports more time than there is', () => {
    expect(expiresInSeconds(0.51)).toBe(30);
  });

  it('floors at zero', () => {
    expect(expiresInSeconds(-5)).toBe(0);
  });
});
