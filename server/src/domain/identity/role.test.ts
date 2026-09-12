import { describe, expect, it } from 'vitest';
import {
  isRole,
  isStaff,
  masterPasswordMayOpen,
  mayCreateStaffAs,
  mayDeleteStaff,
  mayManageStaff,
  mayResetPasswordOf,
  privilegeScope,
} from './role.js';
import { Role } from '../../common/enums/index.js';

describe('isRole', () => {
  it('accepts the three the enum actually has', () => {
    expect(isRole(Role.SUPERADMIN)).toBe(true);
    expect(isRole(Role.ADMIN)).toBe(true);
    expect(isRole(Role.MEMBER)).toBe(true);
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
    expect(masterPasswordMayOpen(Role.MEMBER)).toBe(true);
    expect(masterPasswordMayOpen(Role.ADMIN)).toBe(true);
  });

  it('NEVER opens a superadmin', () => {
    // One shared password reaching the account that can change every other
    // account is total compromise.
    expect(masterPasswordMayOpen(Role.SUPERADMIN)).toBe(false);
  });
});

describe('mayResetPasswordOf', () => {
  it('lets staff reset members and admins', () => {
    expect(mayResetPasswordOf(Role.ADMIN, Role.MEMBER)).toBe(true);
    expect(mayResetPasswordOf(Role.ADMIN, Role.ADMIN)).toBe(true);
  });

  it('lets only a superadmin reset a superadmin', () => {
    expect(mayResetPasswordOf(Role.ADMIN, Role.SUPERADMIN)).toBe(false);
    expect(mayResetPasswordOf(Role.SUPERADMIN, Role.SUPERADMIN)).toBe(true);
  });

  it('never lets a member reset anyone', () => {
    expect(mayResetPasswordOf(Role.MEMBER, Role.MEMBER)).toBe(false);
    expect(mayResetPasswordOf(Role.MEMBER, Role.ADMIN)).toBe(false);
  });
});

describe('mayDeleteStaff', () => {
  const sa = { id: 'a', role: Role.SUPERADMIN };

  it('lets a superadmin delete an admin', () => {
    expect(mayDeleteStaff(sa, 'b', Role.ADMIN)).toBe(true);
  });

  it('refuses to delete yourself', () => {
    // Locking every superadmin out of the system is not an undo-able mistake.
    expect(mayDeleteStaff(sa, 'a', Role.ADMIN)).toBe(false);
  });

  it('refuses to delete another superadmin', () => {
    expect(mayDeleteStaff(sa, 'b', Role.SUPERADMIN)).toBe(false);
  });

  it('refuses to delete a member through the staff route', () => {
    expect(mayDeleteStaff(sa, 'b', Role.MEMBER)).toBe(false);
  });

  it('lets an admin delete another admin — the route checks they hold the page', () => {
    expect(mayDeleteStaff({ id: 'x', role: Role.ADMIN }, 'b', Role.ADMIN)).toBe(true);
  });

  it('never lets an admin delete a superadmin, or themselves', () => {
    expect(mayDeleteStaff({ id: 'x', role: Role.ADMIN }, 'b', Role.SUPERADMIN)).toBe(false);
    expect(mayDeleteStaff({ id: 'x', role: Role.ADMIN }, 'x', Role.ADMIN)).toBe(false);
  });
});

describe('mayManageStaff', () => {
  const sa = { id: 'a', role: Role.SUPERADMIN };
  const admin = { id: 'x', role: Role.ADMIN };

  it('a superadmin manages any admin, but not a superadmin and not themselves', () => {
    expect(mayManageStaff(sa, 'b', Role.ADMIN)).toBe(true);
    expect(mayManageStaff(sa, 'b', Role.SUPERADMIN)).toBe(false);
    expect(mayManageStaff(sa, 'a', Role.ADMIN)).toBe(false);
  });

  it('an admin manages OTHER admins only', () => {
    expect(mayManageStaff(admin, 'b', Role.ADMIN)).toBe(true);
    expect(mayManageStaff(admin, 'b', Role.SUPERADMIN)).toBe(false);
    // A grant one can edit is a grant one can widen.
    expect(mayManageStaff(admin, 'x', Role.ADMIN)).toBe(false);
  });

  it('a member manages nobody', () => {
    expect(mayManageStaff({ id: 'm', role: Role.MEMBER }, 'b', Role.ADMIN)).toBe(false);
  });
});

describe('mayCreateStaffAs', () => {
  it('only a superadmin creates a superadmin, whatever page an admin holds', () => {
    expect(mayCreateStaffAs({ id: 'a', role: Role.SUPERADMIN }, Role.SUPERADMIN)).toBe(true);
    expect(mayCreateStaffAs({ id: 'x', role: Role.ADMIN }, Role.SUPERADMIN)).toBe(false);
  });

  it('either creates an admin', () => {
    expect(mayCreateStaffAs({ id: 'a', role: Role.SUPERADMIN }, Role.ADMIN)).toBe(true);
    expect(mayCreateStaffAs({ id: 'x', role: Role.ADMIN }, Role.ADMIN)).toBe(true);
  });

  it('nobody creates a member through the staff route, and a member creates nothing', () => {
    expect(mayCreateStaffAs({ id: 'a', role: Role.SUPERADMIN }, Role.MEMBER)).toBe(false);
    expect(mayCreateStaffAs({ id: 'm', role: Role.MEMBER }, Role.ADMIN)).toBe(false);
  });
});

describe('privilegeScope', () => {
  it('lets staff act anywhere', () => {
    expect(privilegeScope(Role.ADMIN, false, 'b1')).toEqual({ allowed: true, branchId: null });
    expect(privilegeScope(Role.SUPERADMIN, false, null)).toEqual({ allowed: true, branchId: null });
  });

  it('locks a privileged member to their OWN branch', () => {
    expect(privilegeScope(Role.MEMBER, true, 'b1')).toEqual({ allowed: true, branchId: 'b1' });
  });

  it('refuses a member without the privilege', () => {
    expect(privilegeScope(Role.MEMBER, false, 'b1')).toEqual({ allowed: false, branchId: null });
  });
});
