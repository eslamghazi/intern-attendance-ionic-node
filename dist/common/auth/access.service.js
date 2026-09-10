import { eq } from 'drizzle-orm';
import { adminAssignments, members } from '../../db/schema/index.js';
import { adminScope, coversRequestedFilter, coversUnit, } from '../../domain/access/scope.js';
import { forbidden, notFound } from '../../http/errors.js';
/** What this caller can reach. */
export async function scopeOf(tx, caller) {
    // A superadmin's reach does not depend on assignments, so do not go and read
    // them — this runs on the hot path of every scoped admin request.
    if (caller.role === 'superadmin')
        return { kind: 'all' };
    if (caller.role !== 'admin')
        return { kind: 'none' };
    const assignments = await tx.select({ branchId: adminAssignments.branchId, groupId: adminAssignments.groupId })
        .from(adminAssignments)
        .where(eq(adminAssignments.adminId, caller.id));
    return adminScope(caller.role, assignments);
}
/**
 * Refuse unless the caller's scope reaches this branch/group.
 *
 * 403, not an empty result: an admin who asks for a branch they do not run has
 * made a mistake worth telling them about, and silently returning nothing is
 * how "the app is broken" tickets start.
 */
export async function requireUnit(tx, caller, unit) {
    if (!coversUnit(await scopeOf(tx, caller), unit))
        throw forbidden('outside your assignments');
}
/**
 * Refuse unless the caller may ask for this filter.
 *
 * Stricter than requireUnit: an assigned admin must NAME a branch or group they
 * cover. Leaving the filter empty means "everyone", which is exactly what the
 * assignment narrows them out of.
 */
export async function requireFilter(tx, caller, filter) {
    if (!coversRequestedFilter(await scopeOf(tx, caller), filter)) {
        throw forbidden('outside your assignments');
    }
}
/** Refuse unless the caller's scope reaches the member. */
export async function requireMember(tx, caller, memberId) {
    const scope = await scopeOf(tx, caller);
    if (scope.kind === 'all')
        return;
    const rows = await tx.select({ branchId: members.branchId, groupId: members.groupId })
        .from(members)
        .where(eq(members.id, memberId))
        .limit(1);
    const unit = rows[0] ?? null;
    // Same 404 an unknown member gets. An admin outside the scope must not be
    // able to tell "no such member" from "not yours" by the status code.
    if (!unit)
        throw notFound('member_not_found');
    if (!coversUnit(scope, unit))
        throw notFound('member_not_found');
}
/** Refuse unless the caller's scope reaches the branch. */
export async function requireBranch(tx, caller, branchId) {
    const scope = await scopeOf(tx, caller);
    if (scope.kind === 'all')
        return;
    if (!coversUnit(scope, { branchId, groupId: null })) {
        throw forbidden('outside your assignments');
    }
}
//# sourceMappingURL=access.service.js.map