// The member face-tool: look a student up by their CODE (name + whether a face
// is enrolled) and clear that enrolled face. Who may do this — staff, or a
// member granted can_reset_face and locked to their own branch — is decided by
// the API, never here.
import { apiFetch } from './http';

export interface FaceLookupResult {
  found: boolean;
  member_id?: string;
  member_code?: string;
  full_name?: string;
  enrolled?: boolean;
}

export function faceLookup(code: string): Promise<FaceLookupResult> {
  return apiFetch('/face/lookup', { method: 'POST', body: { code } });
}

export function faceReset(member_id: string): Promise<{ ok: boolean }> {
  return apiFetch('/face/tool-reset', { method: 'POST', body: { member_id } });
}
