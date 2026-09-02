// Authentication against the Node API.
//
// The old flow made three network calls in sequence: member-login, then GoTrue
// signInWithPassword, then master-login. All three checks are server-side
// facts, so they are now one request with the same precedence.
//
// Sign-in returns a PAIR: a short-lived access JWT and a refresh token. The
// access token used to last 30 days on its own, which meant a session could not
// be ended — signing out deleted the client's copy and nothing else, and a
// token lifted off a phone stayed valid for a month.
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
  must_change_password: boolean;
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

/** The forced first change, where there is no old password to prove. Accepted
 *  only while the account is flagged must_change_password. */
export async function setInitialPassword(next: string): Promise<void> {
  const pair = await apiFetch<TokenPair>('/auth/password/initial', {
    method: 'POST',
    body: { new: next },
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
   * The admin UI still offers a "manager" tier, but `public.role` is an enum of
   * exactly ('superadmin', 'admin', 'member') — there has never been a manager
   * value, so creating one always failed at the database. The API rejects it
   * explicitly now instead of surfacing a Postgres type error.
   */
  role?: 'admin' | 'manager';
  assignments?: { group_id?: string | null; branch_id?: string | null }[];
}

export function createStaff(staff: NewStaff): Promise<{ ok: boolean; id: string; password: string }> {
  return apiFetch('/auth/staff', { method: 'POST', body: staff });
}

export function deleteStaff(profileId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/auth/staff/${profileId}`, { method: 'DELETE' });
}
