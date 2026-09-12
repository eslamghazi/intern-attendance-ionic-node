// How far an admin's reach goes.
//
// Beyond "which role are you", this is the ONLY authorization rule in the
// system: an admin is assigned to branches and groups, and sees those. A
// superadmin sees everything; an admin with no assignments is faculty-wide.
//
// WHY IT IS A PURE FUNCTION OVER ROWS
//
// The rule decides who may open a spot-check, mint a QR for a branch, read a
// member's attendance, and edit a roster — requests that arrive through
// different modules and touch different tables. Anything that lives closer to
// one of those paths than the others ends up applied on some and not on others,
// and the gap is invisible: the request succeeds.
//
// So it takes assignment rows and a role, returns a Scope, and has no idea what
// a request is. `common/auth/access.service.ts` is the only thing that reads
// the rows; everything else asks this. It is unit-tested against the truth
// table rather than against a live database.
import { isStaff } from '../identity/role.js';
/**
 * An UNASSIGNED admin sees everything.
 *
 * This surprises people, so it is worth stating plainly: assignments are a
 * narrowing, not a grant. An admin account with no rows in admin_assignments is
 * faculty-wide, which is how the first admins were set up and how a small
 * deployment still runs. Reading it the other way round — no assignments means
 * no access — would lock every existing admin out on the day this shipped.
 */
export function adminScope(role, assignments) {
    if (role === 'superadmin')
        return { kind: 'all' };
    if (!isStaff(role))
        return { kind: 'none' };
    if (assignments.length === 0)
        return { kind: 'all' };
    return {
        kind: 'assigned',
        branchIds: assignments.map((a) => a.branchId).filter((id) => id !== null),
        groupIds: assignments.map((a) => a.groupId).filter((id) => id !== null),
    };
}
/**
 * Does this scope reach that record?
 *
 * OR, not AND: an admin assigned to a branch reaches everything in it whatever
 * group it belongs to, and vice versa. That is what the SQL says, and narrowing
 * it to AND here would quietly hide rows from admins who can see them today.
 *
 * A null branch or group NEVER matches. In SQL `null in (…)` is null, which a
 * policy reads as false; the same has to hold here, or a record with no branch
 * would be reachable by every assigned admin.
 */
export function coversUnit(scope, unit) {
    switch (scope.kind) {
        case 'all':
            return true;
        case 'none':
            return false;
        case 'assigned':
            return ((unit.branchId !== null && scope.branchIds.includes(unit.branchId)) ||
                (unit.groupId !== null && scope.groupIds.includes(unit.groupId)));
    }
}
/**
 * The branch and group a request ASKED for, as a unit to test.
 *
 * A request that names neither is asking for everything, which only an
 * unrestricted scope may have — otherwise it would be a way to skip the check
 * by simply leaving the filter out.
 */
export function coversRequestedFilter(scope, filter) {
    if (scope.kind === 'all')
        return true;
    if (scope.kind === 'none')
        return false;
    if (filter.branchId === null && filter.groupId === null)
        return false;
    return coversUnit(scope, filter);
}
//# sourceMappingURL=scope.js.map