// Domain types mirroring the API schema (see server/src/db/schema).
// Kept as plain interfaces; query sites use `.returns<T>()` for typing.

import type { JsonObject } from './json.types';

export type Role = 'superadmin' | 'admin' | 'manager' | 'member';

export type EnrollmentStatus = 'pending' | 'enrolled';

export type AttendanceStatus = 'present' | 'late' | 'early_leave' | 'absent' | 'left_work';
/** Independent check-OUT dimension, separate from the check-IN `status`. */
export type CheckoutStatus = 'checked_out' | 'early_leave' | 'left_work';

export type AuditEvent =
  | 'login'
  | 'password_changed'
  | 'face_enrolled'
  | 'mock_location_detected'
  | 'out_of_range'
  | 'low_accuracy'
  | 'face_mismatch'
  | 'liveness_failed'
  | 'integrity_failed'
  | 'check_in'
  | 'check_out';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  national_id: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  permissions: import('./permissions').Permissions | null;
  created_by: string | null;
  created_at: string;
}

export interface Institution {
  id: string;
  name: string;
  code: number;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  year: number;
  institution_id: string | null; // -> institutions.id (the reusable institution)
  branch_id: string | null; // -> branches.id (the branch this group belongs to)
  institution_name: string | null; // legacy free label (fallback)
  institution_code: number; // legacy code (fallback)
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  bypass_face: boolean;
  bypass_location: boolean;
  bypass_checkout_window: boolean;
  created_at: string;
  institution?: { name: string | null } | null; // joined (optional)
}

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  // Optional polygon geofence: when set (>= 3 vertices), it replaces the radius
  // circle. Vertices are {lat,lng}; containment is computed in the API
  // (server/src/domain/attendance/geofence.ts), not by the database.
  area_coords: { lat: number; lng: number }[] | null;
  institution_id: string | null; // -> institutions.id (the institution this branch belongs to)
  is_active: boolean;
  bypass_face: boolean;
  bypass_location: boolean;
  // Per-branch check-in controls (enforced server-side):
  qr_enabled: boolean; // location-bypass QR works for this branch
  require_qr: boolean; // block the geofence path — check-in only via QR scan
  block_checkin: boolean; // hard-stop: no check-in/out at all for this branch
  bypass_checkout_window: boolean; // allow check-out any time (check-in still enforced)
  created_at: string;
}

/** Generic shift (applies to all branches/departments). */
export interface Shift {
  id: string;
  name: string;
  key: string | null; // short code used in the monthly roster sheet (e.g. M/N/L)
  start_time: string; // 'HH:mm[:ss]' — derived (= checkin_late) for display/legacy
  end_time: string; // derived (= checkout_open)
  // Per-shift attendance windows (clock times 'HH:mm'). Overnight shifts allowed.
  checkin_open: string | null; // check-in opens
  checkin_late: string | null; // arrive after this => late
  checkin_close: string | null; // last time to check in
  checkout_open: string | null; // check-out opens
  checkout_close: string | null; // last time to check out
  late_from: string | null;
  late_to: string | null;
  late_grace_minutes: number;
  created_at: string;
}

/** One day of an member's monthly roster: which shift on this date. */
export interface RosterDay {
  id: string;
  member_id: string;
  date: string; // yyyy-mm-dd
  shift_id: string;
  shift?: Shift;
}

export interface Member {
  id: string; // == profiles.id
  profile_id: string;
  group_id: string;
  branch_id: string;
  enrollment_status: EnrollmentStatus;
  is_active: boolean;
  bypass_face: boolean;
  bypass_location: boolean;
  bypass_checkout_window?: boolean;
  can_generate_qr?: boolean;
  can_make_roster?: boolean;
  can_reset_face?: boolean;
  created_at: string;
  // joined (optional)
  profile?: Profile;
  group?: Group;
  branch?: Branch;
}

export interface FaceTemplate {
  id: string;
  member_id: string;
  embedding: number[]; // a real[] column, read back as number[]
  photo_path: string | null;
  quality_score: number | null;
  created_at: string;
}

/** Which gates were bypassed at the moment of a check-in / check-out. */
export interface BypassInfo {
  face: boolean;
  location: boolean;
  source: 'flag' | 'window' | 'qr' | null; // where a location bypass came from
  shift_window: boolean;
}

export interface Attendance {
  id: string;
  member_id: string;
  branch_id: string;
  date: string; // yyyy-mm-dd
  status: AttendanceStatus; // check-IN dimension: present | late | absent
  checkout_status: CheckoutStatus | null; // check-OUT dimension
  shift_id: string | null;
  shift_name: string | null;

  check_in_at: string | null;
  check_in_bypass: BypassInfo | null;
  check_out_bypass: BypassInfo | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_accuracy_m: number | null;
  check_in_distance_m: number | null;
  check_in_face_score: number | null;
  check_in_liveness_passed: boolean | null;
  check_in_is_mock: boolean | null;
  check_in_probe_path: string | null;

  check_out_at: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_accuracy_m: number | null;
  check_out_distance_m: number | null;
  check_out_face_score: number | null;
  check_out_liveness_passed: boolean | null;
  check_out_is_mock: boolean | null;
  check_out_probe_path: string | null;

  created_at: string;
}

export interface AdminAssignment {
  id: string;
  admin_id: string;
  group_id: string | null;
  branch_id: string | null;
}

export interface AppSettings {
  id: number; // singleton row = 1
  face_match_threshold: number; // cosine similarity 0..1
  liveness_required: boolean;
  // Which liveness proof the check-in camera asks for: 'action' (an expression
  // challenge), 'turn' (turn the head, verified in 3D), or 'both'.
  liveness_mode: 'action' | 'turn' | 'both';
  default_radius_meters: number;
  max_accuracy_meters: number; // reject GPS fixes worse than this
  shift_start: string; // 'HH:mm'
  shift_end: string; // 'HH:mm'
  late_grace_minutes: number;
  require_play_integrity: boolean;
  bypass_face: boolean; // skip face recognition at check-in
  bypass_location: boolean; // skip geofence/location at check-in
  bypass_checkout_window: boolean; // allow check-out any time (check-in still enforced)
  store_face_images: boolean; // keep the ENROLLMENT face photo in storage
  store_probe_images: boolean; // keep each check-in/out PROBE photo in storage
  qr_requires_member: boolean; // QR bypass must target a specific member
  qr_allow_image: boolean; // allow decoding the QR from a picked image
  qr_validity_seconds: number; // how long each location QR token stays valid
  qr_bypass_minutes: number; // minutes a QR scan keeps location bypassed
  // Shift-time enforcement (the actual windows are per-shift, see Shift)
  enforce_shift_window: boolean; // reject check-in/out outside each shift's window
  auto_leave_work: boolean; // auto-mark checked-in-but-not-out as "left work"
  capture_hold_seconds: number; // seconds to hold a steady face before auto-capture
  // Organization branding (shown in-app + on every export). Logo is a data URL.
  org_name: string | null;
  org_logo_url: string | null;
  // Terminology preset: 'generic' | 'students' | 'employees' (member wording).
  terminology: string;
  // Whether members may have/upload a profile photo.
  member_photos: boolean;
  // Global check-in method (mirrors the per-branch control; most restrictive of
  // the two wins). 'location' | 'qr' | 'both' | 'none'.
  checkin_method: 'location' | 'qr' | 'both' | 'none';
  // Show the "your location vs. branch" map when a check-in fails out-of-range.
  show_out_of_range_map: boolean;
  // Reject check-in when Android Developer Options is enabled (mock-GPS gate).
  block_dev_options: boolean;
  // Web anti-spoof: max km allowed between the GPS fix and the caller's IP
  // location before a browser check-in is rejected. 0 disables the check.
  location_ip_max_km: number;
  // Web anti-spoof: sample several GPS fixes and reject a "frozen" (no-jitter)
  // position — a sign of a mock app feeding a constant point. Opt-in.
  web_detect_frozen_gps: boolean;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  event: AuditEvent;
  detail: JsonObject | null;
  created_at: string;
}
