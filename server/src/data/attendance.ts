// Data access for attendance. Every function takes an OPEN transaction and
// returns domain shapes — snake_case stops here.
//
// Passing `tx` in rather than opening one is deliberate: a check-in writes the
// attendance row, may stamp a QR token as used and may record a probe, and all
// of that has to succeed or fail together. It also keeps each request to ONE
// pool connection; a helper that opened its own transaction would hold a second
// one and deadlock the pool under a shift-start rush.
import { sql } from 'drizzle-orm';
import type { DbContext } from '../db/context.js';
import type { ShiftRow } from '../domain/attendance/windows.js';
import type {
  AttendanceRecord,
  AttendanceSettings,
  MemberContext,
} from '../domain/attendance/types.js';
import type { GeofenceResult } from '../domain/attendance/gates.js';
import { query } from '../db/context.js';

const SHIFT_JSON = sql`
  jsonb_build_object(
    'id', s.id, 'name', s.name,
    'checkin_open', s.checkin_open, 'checkin_late', s.checkin_late,
    'checkin_close', s.checkin_close, 'checkout_open', s.checkout_open,
    'checkout_close', s.checkout_close,
    'start_time', s.start_time, 'end_time', s.end_time)
`;

/** The member plus the branch and group flags the decision folds together. */
export async function loadMemberContext(
  tx: DbContext,
  profileId: string,
): Promise<MemberContext | null> {
  const rows = await query<{
    id: string;
    branch_id: string;
    group_id: string | null;
    is_active: boolean | null;
    enrollment_status: string;
    frozen_at: string | null;
    location_bypass_until: string | null;
    bypass_face: boolean | null;
    bypass_location: boolean | null;
    bypass_checkout_window: boolean | null;
    b_face: boolean | null;
    b_location: boolean | null;
    b_checkout: boolean | null;
    b_block: boolean | null;
    b_qr_enabled: boolean | null;
    b_require_qr: boolean | null;
    g_face: boolean | null;
    g_location: boolean | null;
    g_checkout: boolean | null;
    has_branch: boolean;
    has_group: boolean;
  }>(tx, sql`
    select m.id, m.branch_id, m.group_id, m.is_active, m.enrollment_status,
           m.frozen_at, m.location_bypass_until,
           m.bypass_face, m.bypass_location, m.bypass_checkout_window,
           b.bypass_face            as b_face,
           b.bypass_location        as b_location,
           b.bypass_checkout_window as b_checkout,
           b.block_checkin          as b_block,
           b.qr_enabled             as b_qr_enabled,
           b.require_qr             as b_require_qr,
           g.bypass_face            as g_face,
           g.bypass_location        as g_location,
           g.bypass_checkout_window as g_checkout,
           (b.id is not null) as has_branch,
           (g.id is not null) as has_group
      from public.members m
      left join public.branches b on b.id = m.branch_id
      left join public.groups   g on g.id = m.group_id
     where m.profile_id = ${profileId}
     limit 1
  `);

  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    branchId: r.branch_id,
    groupId: r.group_id,
    isActive: r.is_active !== false,
    enrollmentStatus: r.enrollment_status,
    frozenAt: r.frozen_at,
    locationBypassUntil: r.location_bypass_until,
    bypassFace: Boolean(r.bypass_face),
    bypassLocation: Boolean(r.bypass_location),
    bypassCheckoutWindow: Boolean(r.bypass_checkout_window),
    branch: r.has_branch
      ? {
          bypassFace: Boolean(r.b_face),
          bypassLocation: Boolean(r.b_location),
          bypassCheckoutWindow: Boolean(r.b_checkout),
          blockCheckin: Boolean(r.b_block),
          // A branch that never set the flag counts as enabled, matching the
          // `!== false` reading the Edge Function used.
          qrEnabled: r.b_qr_enabled !== false,
          requireQr: Boolean(r.b_require_qr),
        }
      : null,
    group: r.has_group
      ? {
          bypassFace: Boolean(r.g_face),
          bypassLocation: Boolean(r.g_location),
          bypassCheckoutWindow: Boolean(r.g_checkout),
        }
      : null,
  };
}

export async function loadSettings(tx: DbContext): Promise<AttendanceSettings | null> {
  const rows = await query<Record<string, unknown>>(tx, sql`
    select * from public.app_settings where id = 1
  `);
  const s = rows[0];
  if (!s) return null;
  return {
    checkinMethod: (s.checkin_method as AttendanceSettings['checkinMethod']) || 'both',
    enforceShiftWindow: Boolean(s.enforce_shift_window),
    bypassCheckoutWindow: Boolean(s.bypass_checkout_window),
    bypassFace: Boolean(s.bypass_face),
    bypassLocation: Boolean(s.bypass_location),
    livenessRequired: Boolean(s.liveness_required),
    requirePlayIntegrity: Boolean(s.require_play_integrity),
    faceMatchThreshold: Number(s.face_match_threshold),
    maxAccuracyMeters: Number(s.max_accuracy_meters),
    qrRequiresMember: Boolean(s.qr_requires_member),
    storeProbeImages: Boolean(s.store_probe_images),
    shiftStart: (s.shift_start as string | null) ?? null,
    shiftEnd: (s.shift_end as string | null) ?? null,
  };
}

/**
 * Validate a QR token and, if it is single-use, burn it — in one statement, so
 * a token can never be consumed by two concurrent check-ins.
 *
 * Validity is decided by the DATABASE clock, which is the same clock the token
 * was minted against and one no phone can influence.
 */
export async function redeemQrToken(
  tx: DbContext,
  args: { token: string; branchId: string; memberId: string; date: string; requiresMember: boolean },
): Promise<boolean> {
  const rows = await query<{ id: string }>(tx, sql`
    with candidate as (
      select q.id, q.single_use
        from public.qr_tokens q
       where q.token = ${args.token}
         and q.branch_id = ${args.branchId}
         and q.date = ${args.date}
         and q.expires_at > now()
         and (not q.single_use or q.used_at is null)
         and (q.member_id is null or q.member_id = ${args.memberId})
         and (${args.requiresMember}::boolean = false or q.member_id is not null)
       for update skip locked
       limit 1
    ),
    burned as (
      update public.qr_tokens t set used_at = now()
        from candidate c
       where t.id = c.id and c.single_use
      returning t.id
    )
    select id from candidate
  `);
  return rows.length > 0;
}

/** The geofence, recomputed server-side with PostGIS. */
export async function geofenceCheck(
  tx: DbContext,
  branchId: string,
  lat: number,
  lng: number,
): Promise<GeofenceResult | null> {
  const rows = await query<{ within: boolean; distance_m: number; radius_m: number }>(tx, sql`
    select * from public.geofence_check(${branchId}, ${lat}, ${lng})
  `);
  const g = rows[0];
  return g ? { within: g.within, distanceM: g.distance_m, radiusM: g.radius_m } : null;
}

export async function rosteredShifts(
  tx: DbContext,
  memberId: string,
  date: string,
): Promise<ShiftRow[]> {
  const rows = await query<ShiftRow>(tx, sql`
    select s.id, s.name, s.checkin_open, s.checkin_late, s.checkin_close,
           s.checkout_open, s.checkout_close, s.start_time, s.end_time
      from public.roster_days rd
      join public.shifts s on s.id = rd.shift_id
     where rd.member_id = ${memberId} and rd.date = ${date}
  `);
  return rows;
}

export async function attendanceOn(
  tx: DbContext,
  memberId: string,
  date: string,
): Promise<AttendanceRecord[]> {
  const rows = await query<{
    id: string;
    shift_id: string | null;
    status: string;
    checkout_status: string | null;
    check_in_at: string | null;
    check_out_at: string | null;
    shift: ShiftRow | null;
  }>(tx, sql`
    select a.id, a.shift_id, a.status, a.checkout_status, a.check_in_at, a.check_out_at,
           case when s.id is null then null else ${SHIFT_JSON} end as shift
      from public.attendance a
      left join public.shifts s on s.id = a.shift_id
     where a.member_id = ${memberId} and a.date = ${date}
  `);
  return rows.map((r) => ({
    id: r.id,
    shiftId: r.shift_id,
    status: r.status,
    checkoutStatus: r.checkout_status,
    checkInAt: r.check_in_at,
    checkOutAt: r.check_out_at,
    shift: r.shift,
  }));
}

export interface CheckInWrite {
  memberId: string;
  branchId: string;
  date: string;
  status: 'present' | 'late';
  shiftId: string;
  shiftName: string;
  atIso: string;
  lat: number;
  lng: number;
  accuracy: number;
  distance: number;
  faceScore: number | null;
  livenessPassed: boolean;
  isMock: boolean;
  probePath: string | null;
  bypass: Record<string, unknown> | null;
}

export async function writeCheckIn(tx: DbContext, w: CheckInWrite): Promise<void> {
  await tx.execute(sql`
    insert into public.attendance (
      member_id, branch_id, date, status, shift_id, shift_name, check_in_at,
      check_in_lat, check_in_lng, check_in_accuracy_m, check_in_distance_m,
      check_in_face_score, check_in_liveness_passed, check_in_is_mock,
      check_in_probe_path, check_in_bypass
    ) values (
      ${w.memberId}, ${w.branchId}, ${w.date}, ${w.status}::public.attendance_status,
      ${w.shiftId}, ${w.shiftName}, ${w.atIso},
      ${w.lat}, ${w.lng}, ${w.accuracy}, ${w.distance},
      ${w.faceScore}, ${w.livenessPassed}, ${w.isMock},
      ${w.probePath}, ${w.bypass ? JSON.stringify(w.bypass) : null}::jsonb
    )
    on conflict (member_id, date, shift_id) do update set
      status = excluded.status,
      shift_name = excluded.shift_name,
      check_in_at = excluded.check_in_at,
      check_in_lat = excluded.check_in_lat,
      check_in_lng = excluded.check_in_lng,
      check_in_accuracy_m = excluded.check_in_accuracy_m,
      check_in_distance_m = excluded.check_in_distance_m,
      check_in_face_score = excluded.check_in_face_score,
      check_in_liveness_passed = excluded.check_in_liveness_passed,
      check_in_is_mock = excluded.check_in_is_mock,
      check_in_probe_path = excluded.check_in_probe_path,
      check_in_bypass = excluded.check_in_bypass
  `);
}

export interface CheckOutWrite {
  id: string;
  checkoutStatus: 'checked_out' | 'early_leave';
  atIso: string;
  lat: number;
  lng: number;
  accuracy: number;
  distance: number;
  faceScore: number | null;
  livenessPassed: boolean;
  isMock: boolean;
  probePath: string | null;
  bypass: Record<string, unknown> | null;
}

export async function writeCheckOut(tx: DbContext, w: CheckOutWrite): Promise<void> {
  await tx.execute(sql`
    update public.attendance set
      checkout_status = ${w.checkoutStatus},
      check_out_at = ${w.atIso},
      check_out_lat = ${w.lat},
      check_out_lng = ${w.lng},
      check_out_accuracy_m = ${w.accuracy},
      check_out_distance_m = ${w.distance},
      check_out_face_score = ${w.faceScore},
      check_out_liveness_passed = ${w.livenessPassed},
      check_out_is_mock = ${w.isMock},
      check_out_probe_path = ${w.probePath},
      check_out_bypass = ${w.bypass ? JSON.stringify(w.bypass) : null}::jsonb
    where id = ${w.id}
  `);
}

/** Where to file a member's captured photo, from the directory view. */
export async function probeNaming(
  tx: DbContext,
  profileId: string,
): Promise<{ groupYear: number | null; code: string | null } | null> {
  const rows = await query<{
    group_year: number | null;
    member_code: string | null;
    national_id: string | null;
  }>(tx, sql`
    select group_year, member_code, national_id
      from public.member_directory where profile_id = ${profileId} limit 1
  `);
  const r = rows[0];
  if (!r) return null;
  return { groupYear: r.group_year, code: r.member_code ?? r.national_id };
}

/**
 * Best-effort audit. An audit write must never fail the operation it records —
 * and several of these event values only became valid in
 * db/forward/20260901000001_auth_gaps.sql, so before that migration they threw.
 */
export async function writeAudit(
  tx: DbContext,
  actorId: string,
  event: string,
  detail: unknown,
): Promise<void> {
  try {
    await tx.execute(sql`
      insert into public.audit_log (actor_id, event, detail)
      values (${actorId}, ${event}::public.audit_event, ${JSON.stringify(detail)}::jsonb)
    `);
  } catch {
    /* ignore */
  }
}
