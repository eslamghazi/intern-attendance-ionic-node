import { describe, expect, it } from 'vitest';
import { initialPassword, resolveLogin } from './credentials.js';

describe('resolveLogin', () => {
  it('prefers the account own password over the master password', () => {
    expect(resolveLogin('member', true, true)).toBe('own');
    expect(resolveLogin('admin', true, true)).toBe('own');
    // Including for a superadmin, who the master password may not open: their
    // own password must still work when the master one is also set.
    expect(resolveLogin('superadmin', true, true)).toBe('own');
  });

  it('falls back to the master password for members and admins', () => {
    expect(resolveLogin('member', false, true)).toBe('master');
    expect(resolveLogin('admin', false, true)).toBe('master');
  });

  it('never opens a superadmin with the master password', () => {
    expect(resolveLogin('superadmin', false, true)).toBe('forbidden');
  });

  it('refuses when neither matches', () => {
    for (const role of ['member', 'admin', 'superadmin'] as const) {
      expect(resolveLogin(role, false, false)).toBe('refused');
    }
  });
});

describe('initialPassword', () => {
  const member = { role: 'member' as const, nationalId: '29901010101234' };

  it('lets a member with no stored hash sign in with their national id', () => {
    expect(initialPassword({ ...member, passwordHash: null })).toBe('29901010101234');
  });

  it('stops offering it once a password is set', () => {
    expect(initialPassword({ ...member, passwordHash: '$2a$06$abc' })).toBeNull();
  });

  it('gives staff no fallback at all', () => {
    // A staff row with no hash is a broken row. Falling back here would turn a
    // data problem into an admin account openable with a public number.
    expect(
      initialPassword({ role: 'admin', nationalId: '29901010101234', passwordHash: null }),
    ).toBeNull();
    expect(
      initialPassword({ role: 'superadmin', nationalId: '29901010101234', passwordHash: null }),
    ).toBeNull();
  });
});
