// Who someone is, and what that lets them do at the API layer.
//
// This is only HALF the authorization model, and the coarser half: "is this
// endpoint for you at all?", answered by the guards before a handler runs, so a
// member never reaches an admin route and gets a confusing empty result instead
// of a 403.
//
// WHICH ROWS a request may see is the other half, and it lives in
// domain/access/scope.ts — an admin's assignments, applied per query. Neither
// half substitutes for the other: role alone would let one admin read another
// branch's members, and scope alone would let a member call an admin route and
// receive an empty list rather than a refusal.
//
// Both layers matter. Skipping this one leaks the shape of the system; skipping
// the policies leaks the data.

/**
 * `public.role` is an enum of exactly these three.
 *
 * There is no 'manager', even though the admin UI still offers the tier and the
 * old create-staff endpoint accepted it — inserting one always raised
 * invalid_text_representation, so the feature never worked.
 */
import { Role, ROLES, STAFF_ROLES } from '../../common/enums/index.js';
import type { Caller } from './types.js';
import { FIRST_SUPERADMIN } from '../../config/constants.js';
export type { Caller } from './types.js';
export { Role, ROLES, STAFF_ROLES };

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Staff run the admin dashboard; members are the people being recorded. */
export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

/**
 * May the master password open this account?
 *
 * It opens members and admins so support can reproduce a problem, but NEVER a
 * superadmin: one shared password that reaches the account which can change
 * every other account is a single point of total compromise.
 */
export function masterPasswordMayOpen(role: Role): boolean {
  return role !== Role.SUPERADMIN;
}

/** Only a superadmin may reset another superadmin's password. */
export function mayResetPasswordOf(actor: Role, target: Role): boolean {
  if (target === Role.SUPERADMIN) return actor === Role.SUPERADMIN;
  return isStaff(actor);
}

/**
 * The seeded superadmin is nobody's business.
 *
 * The account the API creates on an empty database is the way back in when
 * every other superadmin is gone — so it must not be something another
 * superadmin can see, reset, edit or export. It appears in no list, in no
 * backup, and its actions in the audit trail are attributed to the system.
 * It still signs in, and still holds every page: hidden is not disabled.
 */
export function isHiddenAccount(nationalId: string | null | undefined): boolean {
  return nationalId === FIRST_SUPERADMIN.nationalId;
}

/**
 * Who may manage a staff account — edit it, grant it pages, assign it, delete
 * it. The route decides whether the actor holds the admins page; this decides
 * whether THIS target is theirs to touch.
 *
 * A superadmin manages every admin. An admin holding the page manages OTHER
 * ADMINS only: never a superadmin, who is above them, and never themselves —
 * a grant one can edit is a grant one can widen. Nobody manages a superadmin
 * this way: a superadmin must be dealt with deliberately, not in passing.
 */
export function mayManageStaff(actor: Caller, targetId: string, targetRole: Role): boolean {
  if (!isStaff(actor.role)) return false;
  if (actor.id === targetId) return false;
  return targetRole === Role.ADMIN;
}

/**
 * Deleting staff follows the same line: admins only, never oneself.
 * Locking every superadmin out of the system is not an undo-able mistake.
 */
export function mayDeleteStaff(actor: Caller, targetId: string, targetRole: Role): boolean {
  return mayManageStaff(actor, targetId, targetRole);
}

/**
 * A superadmin is only ever created by a superadmin — whatever page the
 * actor holds. This is the one rung nobody climbs with a grant.
 */
export function mayCreateStaffAs(actor: Caller, role: Role): boolean {
  if (!isStaff(actor.role)) return false;
  if (role === Role.SUPERADMIN) return actor.role === Role.SUPERADMIN;
  return role === Role.ADMIN;
}

/**
 * A member granted a privilege acts only inside their OWN branch — they can
 * cover colleagues, not the institution. Staff are not branch-scoped.
 *
 * Returns the branch to lock to, or null for no restriction.
 */
export function privilegeScope(
  role: Role,
  granted: boolean,
  ownBranchId: string | null,
): { allowed: boolean; branchId: string | null } {
  if (isStaff(role)) return { allowed: true, branchId: null };
  if (role !== Role.MEMBER || !granted) return { allowed: false, branchId: null };
  return { allowed: true, branchId: ownBranchId };
}
