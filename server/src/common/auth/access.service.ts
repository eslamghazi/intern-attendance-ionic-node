// "May this caller act on that?" — asked from inside an open transaction.
//
// Takes a `tx` rather than opening its own: every caller is already inside one,
// and a second transaction would hold a second pool connection while the first
// is still open. That is the deadlock the storage layer already hit once.
import type { DbContext } from '../../infrastructure/database/context.js';
import { eq } from 'drizzle-orm';
import { adminAssignments, members, branches } from '../../infrastructure/database/schema/index.js';
import {
  adminScope,
  coversRequestedFilter,
  coversUnit,
  type Scope,
  type Unit,
} from '../../domain/access/scope.js';
import type { Caller } from '../../domain/identity/role.js';
import { forbidden, notFound } from '../errors.js';

/** What this caller can reach. */
export async function scopeOf(tx: DbContext, caller: Caller): Promise<Scope> {
  // A superadmin's reach does not depend on assignments, so do not go and read
  // them — this runs on the hot path of every scoped admin request.
  if (caller.role === 'superadmin') return { kind: 'all' };
  if (caller.role !== 'admin') return { kind: 'none' };
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
export async function requireUnit(tx: DbContext, caller: Caller, unit: Unit): Promise<void> {
  if (!coversUnit(await scopeOf(tx, caller), unit)) throw forbidden('outside your assignments');
}

/**
 * Refuse unless the caller may ask for this filter.
 *
 * Stricter than requireUnit: an assigned admin must NAME a branch or group they
 * cover. Leaving the filter empty means "everyone", which is exactly what the
 * assignment narrows them out of.
 */
export async function requireFilter(tx: DbContext, caller: Caller, filter: Unit): Promise<void> {
  if (!coversRequestedFilter(await scopeOf(tx, caller), filter)) {
    throw forbidden('outside your assignments');
  }
}

/** Refuse unless the caller's scope reaches the member. */
export async function requireMember(
  tx: DbContext,
  caller: Caller,
  memberId: string,
): Promise<void> {
  const scope = await scopeOf(tx, caller);
  if (scope.kind === 'all') return;
  const rows = await tx.select({ branchId: members.branchId, groupId: members.groupId })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  const unit = rows[0] ?? null;
  // Same 404 an unknown member gets. An admin outside the scope must not be
  // able to tell "no such member" from "not yours" by the status code.
  if (!unit) throw notFound('member_not_found');
  if (!coversUnit(scope, unit)) throw notFound('member_not_found');
}

/**
 * Refuse unless the caller may read THIS member's own records.
 *
 * For the routes a member genuinely needs — their attendance history, their day,
 * their face template — which all take a `member_id` in the request and, until
 * now, believed it. A member could read any other member's attendance simply by
 * changing the number in the URL.
 *
 * `requireMember` alone cannot express this: a member's scope is `none`, so it
 * refuses them their OWN row too. Staff still go through it, so an assigned
 * admin stays inside their assignments.
 *
 * The 404 is deliberate and matches requireMember: "not yours" and "no such
 * member" must be indistinguishable, or the status code becomes an oracle for
 * which member ids exist.
 */
export async function requireSelfOrMember(
  tx: DbContext,
  caller: Caller,
  memberId: string,
): Promise<void> {
  if (caller.role === 'admin' || caller.role === 'superadmin') {
    return requireMember(tx, caller, memberId);
  }

  const rows = await tx.select({ id: members.id })
    .from(members)
    .where(eq(members.profileId, caller.id))
    .limit(1);

  if (!rows[0] || rows[0].id !== memberId) throw notFound('member_not_found');
}

/** Refuse unless the caller's scope reaches the branch. */
export async function requireBranch(
  tx: DbContext,
  caller: Caller,
  branchId: string,
): Promise<void> {
  const scope = await scopeOf(tx, caller);
  if (scope.kind === 'all') return;
  if (!coversUnit(scope, { branchId, groupId: null })) {
    throw forbidden('outside your assignments');
  }
}

/**
 * The caller's reach, in the shape directoryWhere wants.
 *
 * `undefined` for a superadmin — unrestricted. An assigned admin gets their
 * branches and groups; a caller with no reach at all gets empty lists, which
 * directoryWhere turns into "match nothing" rather than "match everything".
 */
export async function scopeFilter(tx: DbContext, caller: Caller) {
  const scope = await scopeOf(tx, caller);
  if (scope.kind === 'all') return undefined;
  if (scope.kind === 'none') return { branchIds: [], groupIds: [] };
  return { branchIds: scope.branchIds, groupIds: scope.groupIds };
}
