// Attendance: the member's own actions, and every admin read.
//
// The month-shaped work — deciding whether a slot is an absence yet, building
// the monthly matrix, computing the dashboard rate — used to happen here, after
// downloading a whole month of roster and attendance rows in id-chunks. It now
// happens in the database (see public.slot_concluded), so these are thin.
import { apiFetch } from './http';
import { monthBounds, type PageOpts } from './members';
import type { Attendance, AttendanceStatus, CheckoutStatus } from '../types';
import type { Outcome } from '../outcome';
import type { JsonObject, JsonValue } from '../json.types';

export { monthBounds };

/** Member scans a location QR to unlock a timed location-bypass window. */
export function startQrBypass(
  token: string,
): Promise<{ ok: boolean; until: string; minutes: number }> {
  return apiFetch('/qr/redeem', { method: 'POST', body: { token } });
}

/** One member who is on shift RIGHT NOW (checked in, not yet checked out). */
export interface PresentRow {
  member_id: string;
  full_name: string;
  national_id: string;
  branch_id: string | null;
  branch_name: string | null;
  group_id: string | null;
  group_name: string | null;
  shift_id: string | null;
  shift_name: string | null;
  status: string;
  checkout_status: string | null;
  check_in_at: string;
  date: string;
}

/**
 * Live presence: every member currently ON shift. Pass [today, yesterday] so
 * overnight shifts that started yesterday are included.
 */
export function listPresentNow(dates: string[]): Promise<PresentRow[]> {
  return apiFetch(`/attendance/present?dates=${encodeURIComponent(dates.join(','))}`);
}

/** One typed slot of an attendance file, resolved to ids. */
export interface ImportAttendanceRow {
  member_id: string;
  date: string;
  shift_id: string;
  check_in: string | null;
  check_out: string | null;
}

export type ImportAttendanceOutcome = 'written' | 'no_roster' | 'not_yours' | 'invalid';

export interface ImportAttendanceResult {
  written: number;
  no_roster: number;
  not_yours: number;
  invalid: number;
  rows: { index: number; outcome: ImportAttendanceOutcome }[];
}

/**
 * Attendance from a file, written only onto rostered slots. The server
 * decides late and early leave from the shift's windows, exactly as at the
 * door, and reports every row that did not land by its index.
 */
export function importAttendance(rows: ImportAttendanceRow[]): Promise<ImportAttendanceResult> {
  return apiFetch('/attendance/import', { method: 'POST', body: { rows } });
}

/** Admin manually sets a member's status for a date + shift. */
export function setAttendance(
  member_id: string,
  date: string,
  status: 'present' | 'late' | 'absent' | 'early_leave',
  shift_id?: string | null,
): Promise<{ ok: boolean }> {
  return apiFetch('/attendance/set', {
    method: 'POST',
    body: { member_id, date, status, shift_id: shift_id ?? null },
  });
}

/** Admin removes a recorded attendance (one shift, or the whole day). */
export function clearAttendance(
  member_id: string,
  date: string,
  shift_id?: string | null,
): Promise<{ ok: boolean }> {
  return apiFetch('/attendance/set', {
    method: 'POST',
    body: { member_id, date, clear: true, shift_id: shift_id ?? null },
  });
}

export interface RecordPayload {
  type: 'check_in' | 'check_out';
  lat: number;
  lng: number;
  accuracy: number;
  is_mock: boolean;
  liveness_passed: boolean;
  /**
   * The similarity this client computed. ADVISORY — the server recomputes it
   * from `probe_embedding` and uses its own answer.
   */
  face_score: number;
  /**
   * The 512-dim embedding of the captured face: the vector that produced
   * `face_score`. Sending it is what lets the server verify the match against
   * the enrolled template instead of believing a number the client chose.
   */
  probe_embedding?: number[] | null;
  probe_path?: string | null;
  probe_base64?: string | null;
  integrity_token?: string | null;
  qr_token?: string | null;
  shift_id?: string | null;
}

export interface RecordResult {
  ok: true;
  type: 'check_in' | 'check_out';
  status: string;
  distance: number;
}

export class AttendanceError extends Error {
  reason: string;
  detail: JsonObject;
  constructor(reason: string, detail: JsonObject = {}) {
    super(reason);
    this.reason = reason;
    this.detail = detail;
  }
}

/**
 * The validated check-in / check-out. Every gate — mock GPS, accuracy, the
 * geofence, liveness, the face score, the shift window — is re-checked on the
 * server; a rejection comes back as `{ reason, … }`, which is what the UI
 * switches on to pick its message.
 */
export async function recordAttendance(payload: RecordPayload): Promise<RecordResult> {
  try {
    const data = await apiFetch<RecordResult & { reason?: string }>('/attendance/record', {
      method: 'POST',
      body: payload,
    });
    if (data?.reason) throw new AttendanceError(data.reason, { ...data });
    return data;
  } catch (err) {
    if (err instanceof AttendanceError) throw err;
    const e = err as { status?: number; code?: string; message?: string; body?: JsonValue };
    throw new AttendanceError(e.code ?? 'error', {
      reason: e.code ?? null,
      message: e.message ?? null,
    });
  }
}

export type DailyStatus = AttendanceStatus | 'pending';

/** One line of a member's own history: an attendance record, or a rostered day
 *  they never checked into (absence is never stored as a row). */
export interface HistoryEntry {
  id: string;
  date: string;
  shift_id: string | null;
  shift_name: string | null;
  status: DailyStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  checkout_status: CheckoutStatus | null;
  /**
   * How the arrival and the departure combine, decided server-side.
   *
   * `status` and `checkout_status` are the two raw axes; this is the pair named.
   * Render from THIS — a screen that combines the axes itself will combine them
   * differently from the next screen, and differently again from an export.
   */
  outcome: Outcome;
}

/**
 * A member's whole month, ROSTER-FIRST.
 *
 * Reading the attendance table alone shows nothing for a member who was absent
 * all month — there is no row to find. So the API starts from what they were
 * rostered for and fills in what happened. Upcoming days read as `pending`, so
 * the member sees what they still have coming as well as what they missed.
 */
export function getAttendanceHistory(
  memberId: string,
  year?: number,
  month?: number,
): Promise<HistoryEntry[]> {
  const p = new URLSearchParams({ member_id: memberId });
  if (year && month) {
    p.set('year', String(year));
    p.set('month', String(month));
  }
  return apiFetch(`/attendance/history?${p}`);
}

export interface DayShift {
  id: string;
  name: string;
  key: string | null;
  start_time: string;
  end_time: string;
  checkin_open: string | null;
  checkin_late: string | null;
  checkin_close: string | null;
  checkout_open: string | null;
  checkout_close: string | null;
}

export interface DayAttendance {
  id: string;
  date: string;
  shift_id: string | null;
  shift_name: string | null;
  status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  shift: DayShift | null; // window fields for client-side window checks
}

/** Both halves of a member's day in one request. */
function getDay(
  memberId: string,
  date: string,
): Promise<{ shifts: DayShift[]; attendance: DayAttendance[] }> {
  return apiFetch(
    `/attendance/day?member_id=${encodeURIComponent(memberId)}&date=${encodeURIComponent(date)}`,
  );
}

/** All shifts rostered for a member on a day (0, 1, or many), earliest first. */
export async function getDayShifts(memberId: string, date: string): Promise<DayShift[]> {
  return (await getDay(memberId, date)).shifts;
}

/** All attendance rows for a member on a day (one per shift), earliest first. */
export async function getDayAttendance(
  memberId: string,
  date: string,
): Promise<DayAttendance[]> {
  return (await getDay(memberId, date)).attendance;
}

/* ---------------- Admin review / reports / dashboard ---------------- */

export interface ReviewRow extends Attendance {
  member: { profile: { full_name: string; national_id: string } | null } | null;
}

export function listReview(date: string, branchId: string): Promise<ReviewRow[]> {
  const p = new URLSearchParams({ date });
  if (branchId) p.set('branch_id', branchId);
  return apiFetch(`/attendance/review?${p}`);
}

/** Full attendance record for one member on a date (the review detail modal). */
export function getAttendanceDetail(
  memberId: string,
  date: string,
  shiftId?: string | null,
): Promise<ReviewRow | null> {
  const p = new URLSearchParams({ member_id: memberId, date });
  if (shiftId) p.set('shift_id', shiftId);
  return apiFetch(`/attendance/detail?${p}`);
}

interface ShiftLite {
  name: string;
  key: string | null;
  start_time: string;
  end_time: string;
}

export interface DailyRosterRow {
  member_id: string;
  full_name: string;
  national_id: string;
  shift: ShiftLite | null;
  check_in_at: string | null;
  check_out_at: string | null;
  status: DailyStatus;
}

/**
 * Everyone expected on `date` for a branch, merged with who actually came:
 *   present/late/early_leave — they checked in
 *   pending — no check-in and the shift can still be checked into
 *   absent  — no check-in and the shift's check-out window has closed
 * Already ordered by that rank, then by name.
 */
export function listDailyRoster(date: string, branchId: string): Promise<DailyRosterRow[]> {
  const p = new URLSearchParams({ date });
  if (branchId) p.set('branch_id', branchId);
  return apiFetch(`/attendance/daily-roster?${p}`);
}

export interface MonthlyAttendanceRow {
  member_id: string;
  full_name: string;
  national_id: string;
  // day-of-month -> one CHECK-IN status PER rostered/attended shift that day.
  days: Record<number, DailyStatus[]>;
  // Parallel to days[day]: the CHECK-OUT dimension for each shift (or null).
  checkouts: Record<number, (CheckoutStatus | null)[]>;
}

/** Server-paged whole-month attendance matrix for a branch. */
export function listMonthlyAttendance(
  o: PageOpts,
): Promise<{ rows: MonthlyAttendanceRow[]; total: number }> {
  const p = new URLSearchParams({
    year: String(o.year),
    month: String(o.month),
    page: String(o.page),
    page_size: String(o.pageSize),
    field: o.field,
  });
  if (o.branchId) p.set('branchId', o.branchId);
  if (o.search.trim()) p.set('search', o.search.trim());
  if (o.departmentId) p.set('departmentId', o.departmentId);
  if (o.groupId) p.set('groupId', o.groupId);
  if (o.shiftId) p.set('shiftId', o.shiftId);
  if (o.day) p.set('day', String(o.day));
  return apiFetch(`/attendance/monthly?${p}`);
}

export interface ReportRow {
  date: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  member: {
    group_id: string;
    profile: { full_name: string; national_id: string } | null;
    group: { name: string } | null;
    branch: { name: string } | null;
  } | null;
}

export function listReport(
  from: string,
  to: string,
  branchId: string,
  groupId: string,
): Promise<ReportRow[]> {
  const p = new URLSearchParams({ from, to });
  if (branchId) p.set('branch_id', branchId);
  // The group filter is applied in SQL now, not by filtering the whole range
  // after it has been downloaded.
  if (groupId) p.set('group_id', groupId);
  return apiFetch(`/attendance/report?${p}`);
}

export interface TodayStatusRow {
  status: string;
  check_in_at: string | null;
  branch_id: string;
  member: { group_id: string | null } | null;
}

export function listTodayStatuses(date: string): Promise<TodayStatusRow[]> {
  return apiFetch(`/attendance/today?date=${encodeURIComponent(date)}`);
}

export interface StatsFilter {
  year: number;
  month: number;
  today: string; // server date (yyyy-mm-dd)
  day?: number | null; // narrow to a single day-of-month
  branchId?: string;
  groupId?: string;
  shiftId?: string;
  departmentId?: string; // member's department for this month
}

export interface DayStat {
  day: number;
  attended: number; // check-ins that day (including shifts still running)
  absent: number; // finished slots nobody checked into
  pending: number; // still-open slots nobody has checked into yet
  /** Slots that have a verdict: attended-and-finished + absent. */
  settled: number;
  /** Still-open slots in total (checked in or not). */
  open: number;
  /** Percent — over settled slots, or over the open ones when nothing has
   *  settled yet. 0 when there is nothing at all. */
  rate: number;
}

export interface MonthStats {
  attended: number; // shift-slots with a check-in in the period
  present: number; // attended minus late
  late: number; // late check-ins
  absent: number; // rostered slots whose check-out window closed with no check-in
  /** Still-open rostered slots nobody has checked into. */
  pending: number;
  /** Check-ins on slots that are still running. */
  attendedOpen: number;
  /** Slots the period can actually judge: finished-and-attended + absent. */
  settled: number;
  /** What the rate was measured against — so the UI can say which. */
  rateBasis: 'settled' | 'open' | 'none';
  /** Attendance percent over SETTLED slots only. 0 when nothing has settled yet
   *  (the caller should show "—", not "0%"). */
  rate: number;
  perBranch: { branch_id: string; value: number }[];
  perGroup: { group_id: string; value: number }[];
  perShift: { shift_id: string; value: number }[];
  perBranchStatus: { branch_id: string; present: number; late: number; absent: number }[];
  perDay: DayStat[]; // daily trend across the month (empty when a day is picked)
}

/**
 * Attendance aggregate for the admin dashboard.
 *
 * The rate is computed over SETTLED slots — a slot counts once its check-out
 * window has closed, either as attended or as absent. A shift still running is
 * neither: nobody is late for it yet. Two check-ins at 8am out of 400 shifts
 * rostered for today is NOT 100% attendance, and the other 398 are NOT
 * absences — they are pending, and reported as such.
 *
 * One exception: when the filtered period contains nothing settled, the rate
 * falls back to "how many of the expected have arrived so far". The moment the
 * view also holds finished slots the open ones drop out again, so an early
 * arrival can never inflate a real result.
 */
export function getMonthStats(f: StatsFilter): Promise<MonthStats> {
  const p = new URLSearchParams({ year: String(f.year), month: String(f.month) });
  if (f.day) p.set('day', String(f.day));
  if (f.branchId) p.set('branchId', f.branchId);
  if (f.groupId) p.set('groupId', f.groupId);
  if (f.shiftId) p.set('shiftId', f.shiftId);
  if (f.departmentId) p.set('departmentId', f.departmentId);
  return apiFetch(`/attendance/stats?${p}`);
}

/** One stored check-in / check-out photo, as the admin image browser lists it. */
export interface ProbeImage {
  member_id: string;
  date: string;
  shift_name: string | null;
  type: 'check_in' | 'check_out';
  /** Path inside the private `probes` kind — sign it before showing. */
  path: string;
  at: string | null;
  face_score: number | null;
}

/**
 * Stored attendance photos for the given members over a date range. The paths
 * come from the attendance rows themselves, not from guessing the storage
 * layout — the folder name is built from the member code, which can change.
 */
export function listProbeImages(o: {
  memberIds: string[];
  from: string;
  to: string;
}): Promise<ProbeImage[]> {
  if (!o.memberIds.length) return Promise.resolve([]);
  return apiFetch('/attendance/probes', {
    method: 'POST',
    body: { member_ids: o.memberIds, from: o.from, to: o.to },
  });
}

/** Every check-in/out photo path the system holds — what "empty all" clears. */
export function listAllProbePaths(): Promise<string[]> {
  return apiFetch('/attendance/probe-paths');
}
