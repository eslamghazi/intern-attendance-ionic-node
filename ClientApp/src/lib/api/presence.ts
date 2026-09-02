// Surprise presence spot-check (in-app polling).
//
// The Edge Function took an `action` discriminator on one endpoint; the API has
// a route per operation instead. Signatures are unchanged, so no page moves.
import { apiFetch } from './http';

export interface PresenceCheckRow {
  id: string;
  created_by: string | null;
  branch_id: string | null;
  group_id: string | null;
  department_id: string | null;
  shift_id: string | null;
  date: string;
  deadline: string;
  target_member_ids: string[];
  status: 'open' | 'resolved' | 'cancelled';
  decision: 'left_work' | 'keep' | null;
  created_at: string;
  resolved_at: string | null;
  target_count: number;
  confirmed_count: number;
  past_deadline: boolean;
  /** Target members who have not confirmed yet (for manual admin confirmation). */
  pending: { member_id: string; full_name: string }[];
}

/** Admin: create a spot-check for the members on shift now matching the filters. */
export function createPresenceCheck(input: {
  branch_id?: string;
  group_id?: string;
  department_id?: string;
  shift_id?: string;
  deadline_minutes: number;
}): Promise<{ ok: boolean; target_count: number }> {
  return apiFetch('/presence/checks', { method: 'POST', body: input });
}

/** Admin: the caller's recent spot-checks with confirmation counts. */
export function listPresenceChecks(): Promise<{ checks: PresenceCheckRow[] }> {
  return apiFetch('/presence/checks');
}

/** Admin: resolve non-confirmers — mark them "left work" or keep them. */
export function resolvePresenceCheck(
  check_id: string,
  decision: 'left_work' | 'keep',
): Promise<{ ok: boolean; decision: string }> {
  return apiFetch(`/presence/checks/${check_id}/resolve`, {
    method: 'POST',
    body: { decision },
  });
}

/** Admin: delete a spot-check request (cancels it; confirmations cascade). */
export function deletePresenceCheck(check_id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/presence/checks/${check_id}`, { method: 'DELETE' }).then(() => ({ ok: true }));
}

/** Admin: manually confirm a specific member is present (verified in person). */
export function confirmMemberPresence(check_id: string, member_id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/presence/checks/${check_id}/confirm`, {
    method: 'POST',
    body: { member_id },
  });
}

/** Member: any open spot-check targeting me that I have not confirmed yet. */
export function pollPresence(): Promise<{ pending: { check_id: string; deadline: string } | null }> {
  return apiFetch('/presence/pending');
}

/** Member: confirm I'm present for a spot-check. */
export function confirmPresence(check_id: string): Promise<{ ok: boolean }> {
  return apiFetch('/presence/confirm', { method: 'POST', body: { check_id } });
}
