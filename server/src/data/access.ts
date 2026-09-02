// Loading a caller's reach. Takes an OPEN transaction.
//
// The database side of domain/access/scope.ts — everything here is a read, the
// deciding happens there.
import { sql } from 'drizzle-orm';
import type { DbContext } from '../db/context.js';
import { query } from '../db/context.js';
import type { Assignment, Unit } from '../domain/access/scope.js';

/**
 * An admin's assignments.
 *
 * Read as the service role on purpose. admin_assignments has its own policies,
 * and asking under the caller's context would make "what may this caller see?"
 * depend on a policy the caller could be denied by — the question would answer
 * itself with an empty list, which adminScope() reads as "unrestricted".
 * Getting that backwards is the difference between a narrowed admin and one
 * with the run of the place.
 */
export async function loadAssignments(tx: DbContext, adminId: string): Promise<Assignment[]> {
  const rows = await query<{ branch_id: string | null; group_id: string | null }>(
    tx,
    sql`select branch_id, group_id from public.admin_assignments where admin_id = ${adminId}`,
  );
  return rows.map((r) => ({ branchId: r.branch_id, groupId: r.group_id }));
}

/** Where a member sits, for a scope test. Null when there is no such member. */
export async function memberUnit(tx: DbContext, memberId: string): Promise<Unit | null> {
  const rows = await query<{ branch_id: string | null; group_id: string | null }>(
    tx,
    sql`select branch_id, group_id from public.members where id = ${memberId} limit 1`,
  );
  const row = rows[0];
  return row ? { branchId: row.branch_id, groupId: row.group_id } : null;
}

/** Where a branch sits. A branch is its own unit; it has no group. */
export async function branchUnit(tx: DbContext, branchId: string): Promise<Unit | null> {
  const rows = await query<{ id: string }>(
    tx,
    sql`select id from public.branches where id = ${branchId} limit 1`,
  );
  return rows[0] ? { branchId: rows[0].id, groupId: null } : null;
}
