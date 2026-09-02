import { describe, expect, it } from 'vitest';
import {
  isRole,
  isStaff,
  masterPasswordMayOpen,
  mayChangePasswordWithoutCurrent,
  mayDeleteStaff,
  mayResetPasswordOf,
  privilegeScope,
} from './role.js';

describe('isRole', () => {
  it('accepts the three the enum actually has', () => {
    expect(isRole('superadmin')).toBe(true);
    expect(isRole('admin')).toBe(true);
    expect(isRole('member')).toBe(true);
  });

  it('rejects manager — the enum has never had it', () => {
    expect(isRole('manager')).toBe(false);
  });

  it('rejects anything else', () => {
    expect(isRole('')).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});

describe('masterPasswordMayOpen', () => {
  it('opens members and admins', () => {
    expect(masterPasswordMayOpen('member')).toBe(true);
    expect(masterPasswordMayOpen('admin')).toBe(true);
  });

  it('NEVER opens a superadmin', () => {
    // One shared password reaching the account that can change every other
    // account is total compromise.
    expect(masterPasswordMayOpen('superadmin')).toBe(false);
  });
});

describe('mayResetPasswordOf', () => {
  it('lets staff reset members and admins', () => {
    expect(mayResetPasswordOf('admin', 'member')).toBe(true);
    expect(mayResetPasswordOf('admin', 'admin')).toBe(true);
  });

  it('lets only a superadmin reset a superadmin', () => {
    expect(mayResetPasswordOf('admin', 'superadmin')).toBe(false);
    expect(mayResetPasswordOf('superadmin', 'superadmin')).toBe(true);
  });

  it('never lets a member reset anyone', () => {
    expect(mayResetPasswordOf('member', 'member')).toBe(false);
    expect(mayResetPasswordOf('member', 'admin')).toBe(false);
  });
});

describe('mayDeleteStaff', () => {
  const sa = { id: 'a', role: 'superadmin' as const };

  it('lets a superadmin delete an admin', () => {
    expect(mayDeleteStaff(sa, 'b', 'admin')).toBe(true);
  });

  it('refuses to delete yourself', () => {
    // Locking every superadmin out of the system is not an undo-able mistake.
    expect(mayDeleteStaff(sa, 'a', 'admin')).toBe(false);
  });

  it('refuses to delete another superadmin', () => {
    expect(mayDeleteStaff(sa, 'b', 'superadmin')).toBe(false);
  });

  it('refuses to delete a member through the staff route', () => {
    expect(mayDeleteStaff(sa, 'b', 'member')).toBe(false);
  });

  it('refuses an admin doing any of it', () => {
    expect(mayDeleteStaff({ id: 'x', role: 'admin' }, 'b', 'admin')).toBe(false);
  });
});

describe('mayChangePasswordWithoutCurrent', () => {
  it('is allowed only while the account is flagged must-change', () => {
    expect(mayChangePasswordWithoutCurrent(true)).toBe(true);
    expect(mayChangePasswordWithoutCurrent(false)).toBe(false);
  });
});

describe('privilegeScope', () => {
  it('lets staff act anywhere', () => {
    expect(privilegeScope('admin', false, 'b1')).toEqual({ allowed: true, branchId: null });
    expect(privilegeScope('superadmin', false, null)).toEqual({ allowed: true, branchId: null });
  });

  it('locks a privileged member to their OWN branch', () => {
    expect(privilegeScope('member', true, 'b1')).toEqual({ allowed: true, branchId: 'b1' });
  });

  it('refuses a member without the privilege', () => {
    expect(privilegeScope('member', false, 'b1')).toEqual({ allowed: false, branchId: null });
  });
});
