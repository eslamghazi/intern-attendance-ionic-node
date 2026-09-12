// Departments catalog + per-member MONTHLY department assignment.
import { apiFetch } from './http';
import type { Option } from './keys';

export interface Department {
  id: string;
  name: string;
  branch_id: string | null; // the branch this department belongs to
  branch_name: string | null;
}

/** The API already returns the flat { branch_name } shape the UI renders. */
export function listDepartments(): Promise<Department[]> {
  return apiFetch('/departments');
}

/** Lightweight {id, name} options; optionally only a branch's departments. */
export function listDepartmentOptions(branchId?: string): Promise<Option[]> {
  const q = branchId ? `?branch_id=${encodeURIComponent(branchId)}` : '';
  return apiFetch(`/departments/options${q}`);
}

/** Create/update a department under a branch. */
export async function saveDepartment(d: {
  id?: string;
  name: string;
  branch_id: string | null;
}): Promise<void> {
  await apiFetch('/departments', { method: 'PUT', body: d });
}

export async function deleteDepartment(id: string): Promise<void> {
  await apiFetch(`/departments/${id}`, { method: 'DELETE' });
}

/** Every member's department for a given month → { member_id: department_id }. */
export function listMemberDepartments(
  year: number,
  month: number,
): Promise<Record<string, string>> {
  return apiFetch(`/member-departments?year=${year}&month=${month}`);
}

/** Set (or clear when department_id is null) a member's department for a month. */
export async function setMemberDepartment(
  member_id: string,
  year: number,
  month: number,
  department_id: string | null,
): Promise<void> {
  await apiFetch('/member-departments', {
    method: 'PUT',
    body: { member_id, year, month, department_id },
  });
}
