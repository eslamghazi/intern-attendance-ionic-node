// How far an admin's reach goes.
//
// This is the rule `admin_can_access(group_id, branch_id)` encodes in SQL, and
// it is the ONLY authorization rule in this system beyond "which role are you":
// an admin is assigned to branches and groups, and sees those.
//
// WHY IT ALSO HAS TO EXIST HERE
//
// The SQL version is a policy expression, so it only applies to statements that
// run under the caller's RLS context. Three tables — presence_checks,
// presence_confirmations and qr_tokens — have RLS ENABLED WITH NO POLICIES,
// which denies everything, so every route touching them runs as the service
// role instead. Those routes bypass RLS entirely, and there the database has no
// opinion about scope at all: `requireRole('admin')` was the whole check.
//
// That left an admin assigned to one branch able to open a spot-check against
// another branch's members, mint a check-in QR for a branch they do not run,
// and set attendance for anyone. Not because the rule was wrong, but because it
// lived somewhere those requests never went.
import { isStaff, type Role } from '../identity/role.js';

/** One row of admin_assignments. Either column may be null. */
export interface Assignment {
  branchId: string | null;
  groupId: string | null;
}

/** The branch and group a record belongs to. Either may be unknown. */
export interface Unit {
  branchId: string | null;
  groupId: string | null;
}

export type Scope =
  /** Everything: a superadmin, or an admin nobody has narrowed down. */
  | { kind: 'all' }
  /** Only these branches and groups. */
  | { kind: 'assigned'; branchIds: readonly string[]; groupIds: readonly string[] }
  /** Nothing. Members reach their own data by other means, never through this. */
  | { kind: 'none' };

/**
 * An UNASSIGNED admin sees everything.
 *
 * This surprises people, so it is worth stating plainly: assignments are a
 * narrowing, not a grant. An admin account with no rows in admin_assignments is
 * faculty-wide, which is how the first admins were set up and how a small
 * deployment still runs. Reading it the other way round — no assignments means
 * no access — would lock every existing admin out on the day this shipped.
 */
export function adminScope(role: Role, assignments: readonly Assignment[]): Scope {
  if (role === 'superadmin') return { kind: 'all' };
  if (!isStaff(role)) return { kind: 'none' };
  if (assignments.length === 0) return { kind: 'all' };

  return {
    kind: 'assigned',
    branchIds: assignments.map((a) => a.branchId).filter((id): id is string => id !== null),
    groupIds: assignments.map((a) => a.groupId).filter((id): id is string => id !== null),
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
export function coversUnit(scope: Scope, unit: Unit): boolean {
  switch (scope.kind) {
    case 'all':
      return true;
    case 'none':
      return false;
    case 'assigned':
      return (
        (unit.branchId !== null && scope.branchIds.includes(unit.branchId)) ||
        (unit.groupId !== null && scope.groupIds.includes(unit.groupId))
      );
  }
}

/**
 * The branch and group a request ASKED for, as a unit to test.
 *
 * A request that names neither is asking for everything, which only an
 * unrestricted scope may have — otherwise it would be a way to skip the check
 * by simply leaving the filter out.
 */
export function coversRequestedFilter(scope: Scope, filter: Unit): boolean {
  if (scope.kind === 'all') return true;
  if (scope.kind === 'none') return false;
  if (filter.branchId === null && filter.groupId === null) return false;
  return coversUnit(scope, filter);
}
