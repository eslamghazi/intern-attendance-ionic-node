// Who someone is, and what that lets them do at the API layer.
//
// This is NOT the authorization model. That lives in the 47 RLS policies, which
// decide which ROWS a request can see and is the only thing standing between a
// member and another member's data. What is here is the coarser question the
// API answers first — "is this endpoint for you at all?" — so a member never
// reaches an admin handler and gets a confusing empty result instead of a 403.
//
// Both layers matter. Skipping this one leaks the shape of the system; skipping
// the policies leaks the data.
/**
 * `public.role` is an enum of exactly these three.
 *
 * There is no 'manager', even though the admin UI still offers the tier and the
 * old create-staff Edge Function accepted it — inserting one always raised
 * invalid_text_representation, so the feature never worked.
 */
import { Role, ROLES, STAFF_ROLES } from '../../common/enums/index.js';
export { Role, ROLES, STAFF_ROLES };
export function isRole(value) {
    return typeof value === 'string' && ROLES.includes(value);
}
/** Staff run the admin dashboard; members are the people being recorded. */
export function isStaff(role) {
    return STAFF_ROLES.includes(role);
}
/**
 * May the master password open this account?
 *
 * It opens members and admins so support can reproduce a problem, but NEVER a
 * superadmin: one shared password that reaches the account which can change
 * every other account is a single point of total compromise.
 */
export function masterPasswordMayOpen(role) {
    return role !== Role.SUPERADMIN;
}
/** Only a superadmin may reset another superadmin's password. */
export function mayResetPasswordOf(actor, target) {
    if (target === Role.SUPERADMIN)
        return actor === Role.SUPERADMIN;
    return isStaff(actor);
}
/** Deleting staff is superadmin-only, and nobody deletes themselves. */
export function mayDeleteStaff(actor, targetId, targetRole) {
    if (actor.role !== Role.SUPERADMIN)
        return false;
    if (actor.id === targetId)
        return false;
    // Only plain admin accounts are deletable: a superadmin must be demoted
    // deliberately rather than removed in passing.
    return targetRole === Role.ADMIN;
}
/**
 * The forced first password change, where there is no old password to prove.
 *
 * GoTrue allowed this for any signed-in session, which meant a borrowed
 * unlocked phone could take over an account. It is gated on the one state where
 * the user provably has no password of their own yet.
 */
export function mayChangePasswordWithoutCurrent(mustChangePassword) {
    return mustChangePassword;
}
/**
 * A member granted a privilege acts only inside their OWN branch — they can
 * cover colleagues, not the institution. Staff are not branch-scoped.
 *
 * Returns the branch to lock to, or null for no restriction.
 */
export function privilegeScope(role, granted, ownBranchId) {
    if (isStaff(role))
        return { allowed: true, branchId: null };
    if (role !== Role.MEMBER || !granted)
        return { allowed: false, branchId: null };
    return { allowed: true, branchId: ownBranchId };
}
//# sourceMappingURL=role.js.map