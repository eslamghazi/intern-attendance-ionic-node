// Authentication against the Node API.
//
// ONE request for sign-in, whichever credential is used. Which credential wins
// when more than one would match is a server-side rule, written down in
// server/src/domain/identity/credentials.ts — deciding it here, by the order the
// client happens to try things in, would make the precedence an accident of
// client code that no test covers.
//
// Sign-in returns a PAIR: a short-lived access JWT and a refresh token. The
// pairing is what makes signing out real — the server revokes the refresh token,
// so the session ends at the next renewal rather than merely being forgotten by
// this device.
//
// Everything that mints a new pair stores it here, so callers keep their
// existing shape and none of them has to know about tokens.
import { apiFetch, getRefreshToken, setSession } from './http';

export type Role = 'superadmin' | 'admin' | 'member';

export interface LoginResult {
  access_token: string;
  refresh_token: string;
  /** Seconds the access token is good for. */
  expires_in: number;
  token_type: 'Bearer';
  role: Role;
  profile: { id: string; full_name: string };
}

/** A renewed pair, returned by anything that changes a password. */
interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export async function login(nationalId: string, password: string): Promise<LoginResult> {
  const result = await apiFetch<LoginResult>('/auth/login', {
    method: 'POST',
    anonymous: true,
    body: { national_id: nationalId, password },
  });
  await setSession(result);
  return result;
}

/**
 * Sign out this device.
 *
 * Tells the server first, so the refresh token is revoked rather than merely
 * forgotten — that is the whole difference from the old sign-out. The local
 * clear happens either way: a user who taps "sign out" on a train with no
 * signal must still end up signed out.
 */
export async function logout(): Promise<void> {
  const refresh_token = getRefreshToken();
  try {
    if (refresh_token) {
      await apiFetch('/auth/logout', { method: 'POST', anonymous: true, body: { refresh_token } });
    }
  } catch {
    /* revoked on the next cleanup, or when it expires */
  }
  await setSession(null);
}

/** Sign out everywhere — for a lost or stolen phone. */
export async function logoutEverywhere(): Promise<{ revoked: number }> {
  const result = await apiFetch<{ ok: boolean; revoked: number }>('/auth/logout-all', {
    method: 'POST',
  });
  await setSession(null);
  return { revoked: result.revoked };
}

/**
 * Change your own password. Works for members and staff alike.
 *
 * The server revokes every session for the account — including this one — and
 * returns a fresh pair, so the person who just secured their account is not
 * signed out by the act of doing it.
 */
export async function changePassword(current: string, next: string): Promise<void> {
  const pair = await apiFetch<TokenPair>('/auth/password', {
    method: 'POST',
    body: { current, new: next },
  });
  await setSession(pair);
}

export function resetMemberPassword(args: {
  profile_id?: string;
  national_id?: string;
  password?: string;
}): Promise<{ ok: boolean; password: string }> {
  return apiFetch('/auth/members/reset-password', { method: 'POST', body: args });
}

export function resetStaffPassword(profileId: string): Promise<{ ok: boolean; password: string }> {
  return apiFetch('/auth/staff/reset-password', {
    method: 'POST',
    body: { profile_id: profileId },
  });
}

export interface NewStaff {
  national_id: string;
  full_name: string;
  phone?: string | null;
  /**
   * A superadmin may create another superadmin. Only a superadmin can reach
   * the route at all, so this is the one door by which one comes into being
   * by hand — an admin cannot promote anyone, themselves included.
   */
  role?: 'admin' | 'superadmin';
  assignments?: { group_id?: string | null; branch_id?: string | null }[];
}

export function createStaff(staff: NewStaff): Promise<{ ok: boolean; id: string; password: string }> {
  return apiFetch('/auth/staff', { method: 'POST', body: staff });
}

export function deleteStaff(profileId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/auth/staff/${profileId}`, { method: 'DELETE' });
}
