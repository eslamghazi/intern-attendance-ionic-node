// "May this caller act on that?" — asked from inside an open transaction.
//
// Takes a `tx` rather than opening its own: every caller is already inside one,
// and a second transaction would hold a second pool connection while the first
// is still open. That is the deadlock the storage layer already hit once.
import type { DbContext } from '../db/context.js';
import * as data from '../data/access.js';
import {
  adminScope,
  coversRequestedFilter,
  coversUnit,
  type Scope,
  type Unit,
} from '../domain/access/scope.js';
import type { Caller } from '../domain/identity/role.js';
import { forbidden, notFound } from '../http/errors.js';

/** What this caller can reach. */
export async function scopeOf(tx: DbContext, caller: Caller): Promise<Scope> {
  // A superadmin's reach does not depend on assignments, so do not go and read
  // them — this runs on the hot path of every scoped admin request.
  if (caller.role === 'superadmin') return { kind: 'all' };
  if (caller.role !== 'admin') return { kind: 'none' };
  return adminScope(caller.role, await data.loadAssignments(tx, caller.id));
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
  const unit = await data.memberUnit(tx, memberId);
  // Same 404 an unknown member gets. An admin outside the scope must not be
  // able to tell "no such member" from "not yours" by the status code.
  if (!unit) throw notFound('member_not_found');
  if (!coversUnit(scope, unit)) throw notFound('member_not_found');
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
