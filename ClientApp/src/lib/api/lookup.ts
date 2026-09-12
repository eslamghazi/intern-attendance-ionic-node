import { apiFetch } from './http';

/**
 * Find one member by an identifier, anywhere in the faculty.
 *
 * Every other member read this app makes is bounded by the admin's assignments.
 * This one is not, on purpose: a student turns up at the wrong hospital and
 * somebody has to be able to identify them.
 *
 * The server keeps that from becoming a way around the scope — one exact match,
 * never a list, and an audit row when the member is outside the caller's own
 * branches. `in_scope` is returned so the screen can say so plainly rather than
 * letting an admin think the student is theirs.
 */
export interface LookupMember {
  member_id: string;
  profile_id: string;
  member_code: string | null;
  national_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  branch_id: string | null;
  branch_name: string | null;
  group_id: string | null;
  group_name: string | null;
  group_year: number | null;
  institution_name: string | null;
  is_active: boolean;
  enrollment_status: string;
  has_face: boolean;
  frozen_at: string | null;
  bypass_face: boolean;
  bypass_location: boolean;
  can_generate_qr: boolean;
  can_reset_face: boolean;
}

export type LookupResult =
  | { found: false }
  | { found: true; in_scope: boolean; member: LookupMember };

/** `q` is a member code or a national id, matched exactly. */
export function lookupMember(q: string): Promise<LookupResult> {
  return apiFetch<LookupResult>(`/members/lookup?q=${encodeURIComponent(q.trim())}`);
}
