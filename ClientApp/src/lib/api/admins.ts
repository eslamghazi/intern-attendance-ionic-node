// Admin staff + their group/branch assignments.
import { apiFetch } from './http';
import { deleteStaff } from './auth';
import type { Permissions } from '../permissions';

export interface AdminProfile {
  id: string;
  full_name: string;
  national_id: string;
  phone: string | null;
  /** 'manager' is carried only because the UI still branches on it; the
   *  public.role enum has no such value, so it never actually comes back. */
  role: 'admin' | 'manager' | 'superadmin';
  permissions: Permissions | null;
}

export interface Assignment {
  id: string;
  admin_id: string;
  group_id: string | null;
  branch_id: string | null;
  group: { name: string } | null;
  branch: { name: string } | null;
}

export function listAdmins(): Promise<AdminProfile[]> {
  return apiFetch('/admins');
}

export function listAssignments(): Promise<Assignment[]> {
  return apiFetch('/admins/assignments');
}

export async function updateAdmin(input: {
  id: string;
  full_name: string;
  national_id: string;
  phone?: string | null;
  permissions?: Permissions | null;
}): Promise<void> {
  const { id, ...body } = input;
  await apiFetch(`/admins/${id}`, { method: 'PATCH', body });
}

/** Removes the staff auth user + profile (cascades assignments). */
export function deleteAdmin(profileId: string): Promise<{ ok: boolean }> {
  return deleteStaff(profileId);
}

export async function addAssignment(input: {
  admin_id: string;
  group_id?: string | null;
  branch_id?: string | null;
}): Promise<void> {
  await apiFetch('/admins/assignments', { method: 'POST', body: input });
}

export async function removeAssignment(id: string): Promise<void> {
  await apiFetch(`/admins/assignments/${id}`, { method: 'DELETE' });
}
