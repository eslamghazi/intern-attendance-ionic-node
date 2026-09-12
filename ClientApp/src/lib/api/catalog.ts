// Reference data (institutions / branches / groups / shifts). All API access
// for these tables lives here; pages call these functions and never fetch.
//
// The payload shaping that used to happen here — defaulting a radius, dropping
// a polygon with fewer than three vertices, forcing qr_enabled on when a branch
// requires QR — now lives in the API too, because those are rules about the
// data rather than about the form. What is sent is what the form holds.
import { apiFetch } from './http';
import { LOCATION } from '../config';
import type { Group, Branch, Institution, Shift } from '../types';
import type { Option } from './keys';

/* ---------------- Institutions ---------------- */
export function listInstitutions(): Promise<Institution[]> {
  return apiFetch('/institutions');
}

export async function saveInstitution(i: Partial<Institution>): Promise<void> {
  const body = { name: i.name, code: Number(i.code) || 0 };
  await (i.id
    ? apiFetch(`/institutions/${i.id}`, { method: 'PATCH', body })
    : apiFetch('/institutions', { method: 'POST', body }));
}

export async function deleteInstitution(id: string): Promise<void> {
  await apiFetch(`/institutions/${id}`, { method: 'DELETE' });
}

/* ---------------- Branches ---------------- */
export function listBranches(): Promise<Branch[]> {
  return apiFetch('/branches');
}

export function listBranchOptions(): Promise<Option[]> {
  return apiFetch('/branches/options');
}

export async function saveBranch(h: Partial<Branch>): Promise<void> {
  if (h.latitude == null || h.longitude == null) throw new Error('no_point');
  const body = {
    name: h.name,
    address: h.address || null,
    latitude: h.latitude,
    longitude: h.longitude,
    radius_meters: Number(h.radius_meters) || LOCATION.defaultRadiusMeters,
    area_coords: h.area_coords ?? null,
    institution_id: h.institution_id || null,
    bypass_face: !!h.bypass_face,
    bypass_location: !!h.bypass_location,
    bypass_checkout_window: !!h.bypass_checkout_window,
    require_qr: !!h.require_qr,
    qr_enabled: h.qr_enabled ?? true,
    block_checkin: !!h.block_checkin,
  };
  await (h.id
    ? apiFetch(`/branches/${h.id}`, { method: 'PATCH', body })
    : apiFetch('/branches', { method: 'POST', body }));
}

export async function deleteBranch(id: string): Promise<void> {
  await apiFetch(`/branches/${id}`, { method: 'DELETE' });
}

/* ---------------- Groups ---------------- */
export function listGroups(): Promise<Group[]> {
  return apiFetch('/groups');
}

export function listGroupOptions(): Promise<Option[]> {
  return apiFetch('/groups/options');
}

export async function saveGroup(b: Partial<Group>): Promise<void> {
  const body = {
    name: b.name,
    year: Number(b.year),
    institution_id: b.institution_id || null,
    branch_id: b.branch_id || null,
    start_date: b.start_date || null,
    end_date: b.end_date || null,
    bypass_face: !!b.bypass_face,
    bypass_location: !!b.bypass_location,
    bypass_checkout_window: !!b.bypass_checkout_window,
  };
  await (b.id
    ? apiFetch(`/groups/${b.id}`, { method: 'PATCH', body })
    : apiFetch('/groups', { method: 'POST', body }));
}

export async function deleteGroup(id: string): Promise<void> {
  await apiFetch(`/groups/${id}`, { method: 'DELETE' });
}

/* ---------------- Shifts ---------------- */
export function listShifts(): Promise<Shift[]> {
  return apiFetch('/shifts');
}

export interface ShiftKey {
  id: string;
  key: string | null;
}

export function listShiftKeys(): Promise<ShiftKey[]> {
  return apiFetch('/shifts/keys');
}

export async function saveShift(s: Partial<Shift>): Promise<void> {
  const body = {
    name: s.name,
    key: s.key || null,
    checkin_open: s.checkin_open || null,
    checkin_late: s.checkin_late || null,
    checkin_close: s.checkin_close || null,
    checkout_open: s.checkout_open || null,
    checkout_close: s.checkout_close || null,
    start_time: s.start_time ?? '',
    end_time: s.end_time ?? '',
  };
  await (s.id
    ? apiFetch(`/shifts/${s.id}`, { method: 'PATCH', body })
    : apiFetch('/shifts', { method: 'POST', body }));
}

export async function deleteShift(id: string): Promise<void> {
  await apiFetch(`/shifts/${id}`, { method: 'DELETE' });
}
