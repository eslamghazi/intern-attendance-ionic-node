// What the auth module accepts and answers with.

import type { Role } from '../../domain/identity/role.js';
import type { StoredRefreshToken } from '../../domain/auth/refresh.js';
import type { branches, groups, members, profiles } from '../../infrastructure/database/schema/index.js';
import type { AdminPermissions } from '../../domain/identity/types.js';
import type { LatLngRing } from '../../domain/attendance/types.js';

type ProfileRow = typeof profiles.$inferSelect;
type MemberRow = typeof members.$inferSelect;
type BranchRow = typeof branches.$inferSelect;
type GroupRow = typeof groups.$inferSelect;

export interface LoginResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
  role: Role;
  profile: { id: string; full_name: string };
}

export interface RefreshRefusal {
  revokeFamilyId: string | null;
  auditProfileId: string | null;
}

export interface NewStaff {
  national_id: string;
  full_name: string;
  phone?: string | null;
  password?: string;
  role: Role;
  assignments: { group_id?: string | null; branch_id?: string | null }[];
  /** The starting grant; only meaningful for an admin. */
  permissions?: AdminPermissions | null;
}

export interface Account {
  id: string;
  role: Role;
  fullName: string;
  nationalId: string;
  isActive: boolean;
  passwordHash: string | null;
}

export interface StoredToken extends StoredRefreshToken {
  id: string;
}

// --- GET /auth/me ------------------------------------------------------------
//
// The one call the client makes on every open, and the answer the whole session
// is built from: who you are, and — for a member — where you belong, under which
// rules, and whether your face is on file.
//
// SNAKE_CASE, AND NOT THE TABLE ROW. This used to return Drizzle's rows
// straight out, which meant two things at once. It carried `passwordHash` to
// the browser on every sign-in; and it spelled every field the way the DATABASE
// does — `blockCheckin`, `bypassFace`, `radiusMeters` — while the client, and
// the rest of this API, speak snake_case. Every one of those reads came back
// undefined, so a branch's block_checkin, require_qr and bypass_face rules
// were invisible to the app.

/** The caller's own profile. No credential material, by construction. */
export interface MeProfile {
  id: string;
  /** Straight off the column: the same three values the Role enum holds. */
  role: ProfileRow['role'];
  full_name: string;
  national_id: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  permissions: AdminPermissions | null;
  created_by: string | null;
  created_at: string;
}

/** The branch a member checks in at, with the rules the screen applies. */
export interface MeBranch {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  area_coords: LatLngRing;
  is_active: boolean;
  bypass_face: boolean;
  bypass_location: boolean;
  bypass_checkout_window: boolean;
  qr_enabled: boolean;
  require_qr: boolean;
  block_checkin: boolean;
}

export interface MeGroup {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
  bypass_face: boolean;
  bypass_location: boolean;
  bypass_checkout_window: boolean;
  institution_name: string | null;
  institution: { name: string } | null;
}

/** A member's placement, as /auth/me reports it. */
export interface MeMember {
  id: string;
  profile_id: string;
  group_id: string;
  branch_id: string;
  member_code: string | null;
  enrollment_status: 'pending' | 'enrolled';
  is_active: boolean;
  bypass_face: boolean;
  bypass_location: boolean;
  bypass_checkout_window: boolean;
  frozen_at: string | null;
  can_generate_qr: boolean;
  can_make_roster: boolean;
  can_reset_face: boolean;
  created_at: string;
  branch: MeBranch | null;
  group: MeGroup | null;
  /** Whether a face template exists for this member. */
  is_enrolled: boolean;
}

export interface MeResponse {
  /** Null only if the profile was deleted between signing in and asking. */
  profile: MeProfile | null;
  /** Null for staff, who belong to no group or branch. */
  member: MeMember | null;
  is_enrolled: boolean;
}

// --- what the repository hands the mapper ------------------------------------
//
// Named here so the mapper's input is a contract too: change what getProfile
// selects and the mapper stops compiling, rather than quietly emitting
// undefined for a field the client reads.

export type ProfileColumns = {
  id: string;
  role: ProfileRow['role'];
  fullName: string;
  nationalId: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  permissions: AdminPermissions | null;
  createdBy: string | null;
  createdAt: string;
};

export type MemberContextColumns = MemberRow & {
  branch: BranchRow | null;
  group: (GroupRow & { institution: { name: string } | null }) | null;
  is_enrolled: boolean;
};
