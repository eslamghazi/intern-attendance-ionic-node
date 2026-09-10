// Transport for the Node API — the replacement for `supabase-js` as a network
// client. Everything in src/lib/api/ moves onto this one function.
//
// Three behaviours here are carried over from the Supabase client on purpose,
// because other parts of the app depend on them:
//   1. reads are `cache: 'no-store'`, so an export taken right after an edit can
//      never return pre-edit rows (see the note in supabase.ts);
//   2. a network failure or 5xx flips the serverStatus store, which is what
//      drives the "server unreachable" screen — a 4xx must NOT;
//   3. thrown errors carry the raw Postgres `code`/`details`, so dbError.ts
//      keeps translating foreign-key and unique violations unchanged.
import { Preferences } from '@capacitor/preferences';
import { env } from '../env';
import { setReachable } from '../serverStatus';

const TOKEN_KEY = 'member_token';
const REFRESH_KEY = 'member_refresh_token';

/** Error shape the app already knows how to read (see dbError.ts). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** Postgres SQLSTATE when the failure came from the DB, else an API code. */
    readonly code: string,
    message: string,
    readonly details?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Held in memory so every request is synchronous; Preferences is the durable
// copy that survives an app restart.
//
// TWO tokens now. The access token used to last 30 days, which made this file
// simple and the session impossible to revoke: signing out only deleted the
// client's copy, and a token lifted off a phone worked for a month. The access
// token is minutes long now, and the refresh token is what survives — see
// server/src/domain/auth/refresh.ts.
let token: string | null = null;
let refreshToken: string | null = null;

export function getToken(): string | null {
  return token;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export async function setToken(next: string | null): Promise<void> {
  token = next;
  if (next) await Preferences.set({ key: TOKEN_KEY, value: next });
  else await Preferences.remove({ key: TOKEN_KEY });
}

export async function setRefreshToken(next: string | null): Promise<void> {
  refreshToken = next;
  if (next) await Preferences.set({ key: REFRESH_KEY, value: next });
  else await Preferences.remove({ key: REFRESH_KEY });
}

/** Store both halves of a sign-in or a renewal. */
export async function setSession(
  next: { access_token: string; refresh_token: string } | null,
): Promise<void> {
  await setToken(next?.access_token ?? null);
  await setRefreshToken(next?.refresh_token ?? null);
}

/** Restore a persisted session at boot. Returns the access token, if any. */
export async function loadToken(): Promise<string | null> {
  token = (await Preferences.get({ key: TOKEN_KEY })).value ?? null;
  refreshToken = (await Preferences.get({ key: REFRESH_KEY })).value ?? null;
  return token;
}

/**
 * Called when the session cannot be renewed and the app has to go back to the
 * sign-in screen. AuthContext registers the real one at mount; until then it is
 * a no-op so a renewal during boot cannot throw.
 */
let onSessionLost: () => void = () => {};

export function setSessionLostHandler(handler: () => void): void {
  onSessionLost = handler;
}

/**
 * Renew the pair, at most once at a time.
 *
 * SINGLE FLIGHT is not an optimisation here — it is correctness. The dashboard
 * fires several requests at once, and if the access token has expired they all
 * come back 401 together. Refreshing per response would present the same
 * refresh token several times, and the server treats a second use of an
 * already-rotated token as a stolen copy and revokes the whole family. Every
 * caller therefore waits on the same promise.
 */
let inFlight: Promise<boolean> | null = null;

export async function renewSession(): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const presented = refreshToken;
    if (!presented) return false;
    try {
      const res = await fetch(`${env.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh_token: presented }),
        cache: 'no-store',
      });
      if (!res.ok) return false;
      const raw = await res.json();
      const next = (raw && typeof raw === 'object' && 'data' in raw && (raw as any).data)
        ? (raw as any).data
        : raw;
      if (!next?.access_token || !next?.refresh_token) return false;
      await setSession(next);
      return true;
    } catch {
      // A network failure is not an invalid session: keep the tokens and let
      // the caller surface the outage, or the next attempt will renew.
      return false;
    }
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip the Authorization header (login endpoints). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false, signal } = options;

  const send = async (): Promise<Response> => {
    const activeLang = typeof localStorage !== 'undefined' ? localStorage.getItem('lang') || 'ar' : 'ar';
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Language': activeLang,
      'x-language': activeLang,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (!anonymous && token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${env.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal,
    });
  };

  let res: Response;
  try {
    res = await send();

    // The access token expired mid-session. Renew once and replay — the user
    // should never see this. Only for authenticated calls, and never for the
    // sign-in endpoints, where a 401 means the password was wrong.
    if (res.status === 401 && !anonymous && refreshToken) {
      if (await renewSession()) {
        res = await send();
      } else {
        // The refresh token is gone or refused: this session is over.
        await setSession(null);
        onSessionLost();
      }
    }
  } catch (err) {
    // Genuinely unreachable — this is the case the outage screen exists for.
    setReachable(false);
    throw new ApiError(0, 'network', (err as Error).message);
  }

  // A 5xx means the backend is failing; a 4xx is a normal, expected answer and
  // must never be mistaken for an outage.
  if (res.status >= 500) setReachable(false);
  else setReachable(true);

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const e = (payload as { error?: { code?: string; message?: string; pg?: { code?: string; details?: string } } })?.error;
    const directMsg = (payload as { message?: string })?.message;
    throw new ApiError(
      res.status,
      // Prefer the Postgres SQLSTATE so describeDbError() recognises 23503/23505.
      e?.pg?.code ?? e?.code ?? (payload as any)?.code ?? 'unknown',
      e?.message ?? directMsg ?? res.statusText,
      e?.pg?.details,
    );
  }

  // Auto-unwrap new backend architecture envelopes
  if (payload && typeof payload === 'object' && 'ok' in payload && (payload as any).ok === true) {
    if ('total' in payload && Array.isArray((payload as any).data)) {
      // Map PaginatedResponse safely to all expected legacy formats
      return { 
        data: (payload as any).data,
        items: (payload as any).data,
        rows: (payload as any).data,
        total: (payload as any).total,
        meta: (payload as any).meta 
      } as T;
    }
    // Map ApiResponse
    return (payload as any).data as T;
  }

  return payload as T;
}

/**
 * Probe the API. Any HTTP response means the server is serving; only a thrown
 * network error or a 5xx counts as down. Mirrors the old GoTrue health probe.
 */
export async function pingApi(): Promise<boolean> {
  if (!env.isApiConfigured) return false;
  try {
    const res = await fetch(`${env.apiUrl}/health`, { cache: 'no-store' });
    const ok = res.status < 500;
    setReachable(ok);
    return ok;
  } catch {
    setReachable(false);
    return false;
  }
}
