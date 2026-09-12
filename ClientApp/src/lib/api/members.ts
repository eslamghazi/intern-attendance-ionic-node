// Members + the monthly roster.
//
// Every filtered "apply to all" used to work by downloading each matching id
// and sending it back in chunks, because a filter could only travel in the URL.
// The API takes the filter itself, so these are one request and one
// transaction, and the set can no longer change between the read and the write.
import { apiFetch } from './http';
import { changePassword } from './auth';
import { MAX_PAGE_SIZE } from '../config';
import type { Option } from './keys';

/** Toggle-able "magic" flags an admin can filter/bulk-apply on the members grid. */
export type MemberFlag = 'bypass_face' | 'bypass_location';

/** Only-with filters: when a flag is `true`, restrict to members that have it on. */
export interface MemberFilters {
  bypass_face?: boolean;
  bypass_location?: boolean;
  /** Only members whose app clock is frozen at a fixed datetime. */
  frozen?: boolean;
  /** Tri-state: true = face enrolled, false = not enrolled, undefined = all. */
  has_face?: boolean;
  /** Tri-state: true = active, false = inactive, undefined = all. */
  is_active?: boolean;
}

export type SearchField = 'name' | 'national_id' | 'code';

/** Map a search field to its member_directory column (kept for the UI's labels). */
export function searchColumn(field: SearchField): string {
  return field === 'national_id' ? 'national_id' : field === 'code' ? 'member_code' : 'full_name';
}

/** Build the query string every filtered endpoint accepts. */
function filterParams(o: {
  branchId?: string;
  search?: string;
  field?: SearchField;
  filters?: MemberFilters;
  departmentId?: string;
  year?: number;
  month?: number;
}): URLSearchParams {
  const p = new URLSearchParams();
  if (o.branchId) p.set('branchId', o.branchId);
  if (o.search?.trim()) p.set('search', o.search.trim());
  if (o.field) p.set('field', o.field);
  if (o.departmentId) p.set('departmentId', o.departmentId);
  if (o.year) p.set('year', String(o.year));
  if (o.month) p.set('month', String(o.month));
  const f = o.filters ?? {};
  if (f.bypass_face) p.set('bypass_face', 'true');
  if (f.bypass_location) p.set('bypass_location', 'true');
  if (f.frozen) p.set('frozen', 'true');
  if (f.has_face !== undefined) p.set('has_face', String(f.has_face));
  if (f.is_active !== undefined) p.set('is_active', String(f.is_active));
  return p;
}

/** Same fields, as a JSON body for the bulk endpoints. */
function filterBody(o: {
  branchId?: string;
  search?: string;
  field?: SearchField;
  filters?: MemberFilters;
  departmentId?: string;
  year?: number;
  month?: number;
  // Strings, all of them: this is a URLSearchParams turned inside out, and a
  // URLSearchParams holds nothing else.
}): Record<string, string> {
  return Object.fromEntries(filterParams(o).entries());
}

/** Clear a member's enrolled face so they re-capture on next login. */
export function resetFace(member_id: string): Promise<{ ok: boolean }> {
  return apiFetch('/face/reset', { method: 'POST', body: { member_id } });
}

/** A signed-in member changes their own password (verifies the current one). */
export async function changeMemberPassword(
  current: string,
  newPassword: string,
): Promise<{ ok: boolean }> {
  await changePassword(current, newPassword);
  return { ok: true };
}

/** The signed-in member's own composed code (computed server-side). */
export async function getMyMemberCode(): Promise<string | null> {
  const { code } = await apiFetch<{ code: string | null }>('/profile/member-code');
  return code;
}

/** The signed-in member's own members-row id. Used as a fallback when the auth
 *  bundle failed to hydrate `member`, so enrollment isn't dead-ended. */
export async function getMemberIdByProfile(
  profileId: string,
): Promise<{ id: string | null; error: string | null }> {
  try {
    const { id } = await apiFetch<{ id: string | null }>(`/members/by-profile/${profileId}`);
    return { id, error: null };
  } catch (e) {
    return { id: null, error: (e as Error).message };
  }
}

export interface MemberRow {
  id: string;
  profile_id: string;
  group_id: string;
  branch_id: string;
  is_active: boolean;
  bypass_face: boolean;
  bypass_location: boolean;
  bypass_checkout_window: boolean;
  /** When set, this member's app clock is frozen at this ISO datetime. */
  frozen_at: string | null;
  /** Privilege: may generate location QR codes for their own branch. */
  can_generate_qr: boolean;
  can_make_roster: boolean;
  can_reset_face: boolean;
  /** True when the member has an enrolled face print. */
  enrolled: boolean;
  /** Student code: group year + institution code + serial, e.g. 2026010107.
   *  Assigned by the DB when the member row is created and never changed after.
   *  Null while a member has no group. */
  member_code: string | null;
  avatar_url: string | null;
  profile: { full_name: string; national_id: string; phone: string | null; email: string | null } | null;
  group: { name: string } | null;
  branch: { name: string } | null;
}

/**
 * EVERY member, not a page of them.
 *
 * The roster upload maps national_id -> member id through this, so a silent
 * truncation would quietly drop students from an imported roster. The API caps
 * page_size, so the only safe way to mean "all" is to keep asking until the
 * pages run out.
 */
export async function listMembers(): Promise<MemberRow[]> {
  const PAGE = MAX_PAGE_SIZE;
  const out: MemberRow[] = [];
  for (let page = 1; ; page++) {
    const { rows, total } = await listMembersPaged({
      page,
      pageSize: PAGE,
      search: '',
      field: 'name',
    });
    out.push(...rows);
    // Stop on a short page as well as on the count, so a row deleted mid-scan
    // cannot spin this forever.
    if (rows.length < PAGE || out.length >= total) return out;
  }
}

export async function countActiveMembers(): Promise<number> {
  const { count } = await apiFetch<{ count: number }>('/members/count-active');
  return count;
}

export interface UpdateMemberInput {
  member_id: string;
  profile_id: string;
  full_name: string;
  national_id: string;
  phone?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  group_id?: string;
  branch_id?: string;
  is_active?: boolean;
  bypass_face?: boolean;
  bypass_location?: boolean;
  bypass_checkout_window?: boolean;
  /** Frozen clock: ISO datetime, or null to clear. Undefined = leave unchanged. */
  frozen_at?: string | null;
  can_generate_qr?: boolean;
  can_make_roster?: boolean;
  can_reset_face?: boolean;
}

export async function updateMember(input: UpdateMemberInput): Promise<void> {
  const { member_id: memberId, ...body } = input;
  await apiFetch(`/members/${memberId}`, { method: 'PATCH', body });
}

/** How many of the filtered members have each "magic" option on. */
export interface FlagStats {
  total: number;
  bypass_face: number;
  bypass_location: number;
  frozen: number;
}

export function memberFlagStats(o: {
  search: string;
  field: SearchField;
  filters?: MemberFilters;
}): Promise<FlagStats> {
  return apiFetch(`/members/flag-stats?${filterParams(o)}`);
}

/** Permanently delete every member matching the current filter. Deleting the
 *  profile cascades to the member row + attendance + roster + enrollment + QR. */
export async function bulkDeleteMembers(o: {
  search: string;
  field: SearchField;
  filters?: MemberFilters;
}): Promise<number> {
  const { affected } = await apiFetch<{ affected: number }>('/members/bulk/delete', {
    method: 'POST',
    body: filterBody(o),
  });
  return affected;
}

export async function bulkSetMemberFlag(o: {
  search: string;
  field: SearchField;
  filters?: MemberFilters;
  flag: MemberFlag;
  value: boolean;
}): Promise<number> {
  const { affected } = await apiFetch<{ affected: number }>('/members/bulk/flag', {
    method: 'POST',
    body: { ...filterBody(o), flag: o.flag, value: o.value },
  });
  return affected;
}

/** Freeze (or clear, with null) the app clock for every filtered member. */
export async function bulkSetMemberFrozen(o: {
  search: string;
  field: SearchField;
  filters?: MemberFilters;
  frozen_at: string | null;
}): Promise<number> {
  const { affected } = await apiFetch<{ affected: number }>('/members/bulk/frozen', {
    method: 'POST',
    body: { ...filterBody(o), frozen_at: o.frozen_at },
  });
  return affected;
}

/** Bulk-edit common fields (group / branch / active) for every filtered member. */
export async function bulkUpdateMembers(o: {
  search: string;
  field: SearchField;
  filters?: MemberFilters;
  patch: { group_id?: string; branch_id?: string; is_active?: boolean };
}): Promise<number> {
  const { affected } = await apiFetch<{ affected: number }>('/members/bulk/update', {
    method: 'POST',
    body: { ...filterBody(o), ...o.patch },
  });
  return affected;
}

/** Deleting the profile cascades to the member + roster rows. Takes the PROFILE
 *  id — updateMember() takes the member id, so the path spells out which. */
export async function deleteMember(profileId: string): Promise<void> {
  await apiFetch(`/members/by-profile/${profileId}`, { method: 'DELETE' });
}

/* ------------------------------------------------------------------ roster */

export interface RosterDayInput {
  member_id: string;
  date: string;
  shift_id: string;
}

export async function upsertRosterDays(rows: RosterDayInput[]): Promise<void> {
  if (!rows.length) return;
  await apiFetch('/roster/days', { method: 'POST', body: { days: rows } });
}

/** Existing roster-day identity keys (`member_id|date|shift_id`) for the given
 *  members in a month — used to preview which uploaded rows already exist. */
export async function listRosterDayKeys(
  memberIds: string[],
  year: number,
  month: number,
): Promise<string[]> {
  if (!memberIds.length) return [];
  return apiFetch('/roster/existing-keys', {
    method: 'POST',
    body: { member_ids: memberIds, year, month },
  });
}

/** Data a privileged member needs to build a roster for their branch. */
export interface RosterMakerData {
  members: { member_id: string; code: string | null; full_name: string }[];
  shifts: { id: string; key: string | null; name: string }[];
  roster: { member_id: string; day: number; key: string | null }[];
}

export async function getRosterMakerData(year: number, month: number): Promise<RosterMakerData> {
  return (
    (await apiFetch<RosterMakerData>(`/roster/maker-data?year=${year}&month=${month}`)) ?? {
      members: [],
      shifts: [],
      roster: [],
    }
  );
}

/** What a bulk action does to every day in the picked range. */
export type BulkRosterMode =
  /** Assign the shift — and on a day that ALREADY carries it, take it off
   *  instead of writing a duplicate (same toggle as tapping a cell). */
  | 'add'
  /** Take the shift off every day it is assigned in the range. */
  | 'remove'
  /** Make it the ONLY shift on every day in the range (other shifts dropped). */
  | 'replace';

export interface BulkRosterResult {
  /** Members the filter matched. */
  members: number;
  /** Day-assignments created. */
  added: number;
  /** Day-assignments deleted. */
  removed: number;
}

/**
 * Add / remove / replace one shift across a day range for EVERY member of a
 * branch matching the search. All three modes start from what is actually
 * rostered, so a shift is never written twice on the same day.
 */
export function bulkApplyRosterShift(o: {
  branchId: string;
  year: number;
  month: number;
  search: string;
  field: SearchField;
  shiftId: string;
  fromDay: number;
  toDay: number;
  mode: BulkRosterMode;
  /** Restrict to members assigned to this department for the month (optional). */
  departmentId?: string;
}): Promise<BulkRosterResult> {
  return apiFetch('/roster/bulk', {
    method: 'POST',
    body: {
      ...filterBody(o),
      shift_id: o.shiftId,
      from_day: o.fromDay,
      to_day: o.toDay,
      mode: o.mode,
    },
  });
}

export interface MemberPageItem {
  member_id: string;
  full_name: string;
  national_id: string;
  member_code: string | null;
}

/** Common server-side paging/search params for the admin grids. */
export interface PageOpts {
  branchId: string;
  year: number;
  month: number;
  page: number;
  pageSize: number;
  search: string;
  field: SearchField;
  departmentId?: string; // restrict to members in this department for (year, month)
}

export function monthBounds(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    first: `${year}-${pad(month)}-01`,
    last: `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`,
  };
}

/** One page of members for a branch, searchable by name or national id. */
export function listMemberPage(o: {
  branchId: string;
  page: number;
  pageSize: number;
  search: string;
  field: SearchField;
  year?: number;
  month?: number;
  departmentId?: string;
}): Promise<{ items: MemberPageItem[]; total: number }> {
  const p = filterParams(o);
  p.set('page', String(o.page));
  p.set('page_size', String(o.pageSize));
  return apiFetch(`/members/page?${p}`);
}

/** Server-paged, searchable, filterable full member rows for the admin page. */
export function listMembersPaged(o: {
  page: number;
  pageSize: number;
  search: string;
  field: SearchField;
  filters?: MemberFilters;
}): Promise<{ rows: MemberRow[]; total: number }> {
  const p = filterParams(o);
  p.set('page', String(o.page));
  p.set('page_size', String(o.pageSize));
  return apiFetch(`/members?${p}`);
}

/** One rostered shift in a day cell (a day may hold several). */
export interface RosterCell {
  shift_id: string;
  label: string; // shift key (fallback to name)
}

export interface RosterViewRow {
  member_id: string;
  national_id: string;
  member_code: string | null;
  full_name: string;
  days: Record<number, RosterCell[]>; // day-of-month -> shifts that day
}

/** Server-paged monthly roster grid for a branch. */
export function listRosterForBranchMonth(
  o: PageOpts,
): Promise<{ rows: RosterViewRow[]; total: number }> {
  const p = filterParams(o);
  p.set('page', String(o.page));
  p.set('page_size', String(o.pageSize));
  return apiFetch(`/roster/view?${p}`);
}

/** Add a shift to a roster day. Idempotent per (member, date, shift). */
export async function addRosterShift(
  member_id: string,
  date: string,
  shift_id: string,
): Promise<void> {
  await apiFetch('/roster/days', { method: 'POST', body: { member_id, date, shift_id } });
}

/** Remove ONE shift from a roster day (drops just that shift's attendance too,
 *  via the sync trigger). */
export async function removeRosterShift(
  member_id: string,
  date: string,
  shift_id: string,
): Promise<void> {
  await apiFetch('/roster/days', { method: 'DELETE', body: { member_id, date, shift_id } });
}

/** Day-by-day roster totals for a whole filtered month. */
export interface RosterTotals {
  /** day-of-month -> how many shift slots are filled that day */
  perDay: Record<number, number>;
  /** day-of-month -> shift_id -> count, for the per-shift tooltip */
  perDayShift: Record<number, Record<string, number>>;
  /** every slot in the month */
  total: number;
}

/**
 * Totals for the roster grid, counted in the DATABASE over every member the
 * current filters match — not just the twelve on screen. Counting the page
 * would answer a different question than the row is there to answer.
 */
export function listRosterDayTotals(o: {
  branchId: string;
  year: number;
  month: number;
  search: string;
  field: SearchField;
  departmentId?: string;
}): Promise<RosterTotals> {
  return apiFetch(`/roster/totals?${filterParams(o)}`);
}

export type { Option };
