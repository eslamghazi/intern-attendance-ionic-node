import { describe, expect, it } from 'vitest';
import { isRole, masterPasswordMayOpen, mayChangePasswordWithoutCurrent, mayDeleteStaff, mayResetPasswordOf, privilegeScope, } from './role.js';
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
    it('refuses an admin doing any of it', () => {
        expect(mayDeleteStaff({ id: 'x', role: Role.ADMIN }, 'b', Role.ADMIN)).toBe(false);
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
//# sourceMappingURL=role.test.js.map