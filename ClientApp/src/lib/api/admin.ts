// Admin-side account and QR operations.
//
// `invokeFn` is gone: every Edge Function it wrapped is now a route, and
// apiFetch already unwraps the API's error envelope into an ApiError carrying
// the Postgres code, which is what dbError.ts reads.
import { apiFetch } from './http';
import { createStaff, resetMemberPassword, resetStaffPassword, type NewStaff } from './auth';

export type { NewStaff };
export { createStaff, resetMemberPassword, resetStaffPassword };

export interface NewMember {
  national_id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  group_id: string;
  branch_id: string;
}

export interface CreateMemberResult {
  created: number;
  updated: number;
  total: number;
  results: { national_id: string; ok: boolean; updated?: boolean; error?: string }[];
}

export function createMembers(members: NewMember[]): Promise<CreateMemberResult> {
  return apiFetch('/members', { method: 'POST', body: { members } });
}

/** Every existing member's national ID — used to preview import conflicts. */
export function listMemberNationalIds(): Promise<string[]> {
  return apiFetch('/members/national-ids');
}

/** Manager/admin mints a QR location-bypass token; returns the token string. */
export function createQr(input: {
  branch_id: string;
  date: string;
  member_id?: string | null;
}): Promise<{ ok: boolean; token: string; date: string; validity_seconds: number }> {
  return apiFetch('/qr', { method: 'POST', body: input });
}
