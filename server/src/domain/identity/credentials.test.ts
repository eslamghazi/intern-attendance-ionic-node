import { describe, expect, it } from 'vitest';
import { initialPassword, resolveLogin } from './credentials.js';
import { Role } from '../../common/enums/index.js';

describe('resolveLogin', () => {
  it('prefers the account own password over the master password', () => {
    expect(resolveLogin(Role.MEMBER, true, true)).toBe('own');
    expect(resolveLogin(Role.ADMIN, true, true)).toBe('own');
    // Including for a superadmin, who the master password may not open: their
    // own password must still work when the master one is also set.
    expect(resolveLogin(Role.SUPERADMIN, true, true)).toBe('own');
  });

  it('falls back to the master password for members and admins', () => {
    expect(resolveLogin(Role.MEMBER, false, true)).toBe('master');
    expect(resolveLogin(Role.ADMIN, false, true)).toBe('master');
  });

  it('never opens a superadmin with the master password', () => {
    expect(resolveLogin(Role.SUPERADMIN, false, true)).toBe('forbidden');
  });

  it('refuses when neither matches', () => {
    for (const role of Object.values(Role)) {
      expect(resolveLogin(role, false, false)).toBe('refused');
    }
  });
});

describe('initialPassword', () => {
  const member = { role: Role.MEMBER, nationalId: '29901010101234' };

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
      initialPassword({ role: Role.ADMIN, nationalId: '29901010101234', passwordHash: null }),
    ).toBeNull();
    expect(
      initialPassword({ role: Role.SUPERADMIN, nationalId: '29901010101234', passwordHash: null }),
    ).toBeNull();
  });
});
