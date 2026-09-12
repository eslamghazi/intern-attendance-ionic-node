// Transport for the Node API. Everything in src/lib/api/ goes through this one
// function.
//
// Three behaviours are load-bearing, because other parts of the app depend on
// them:
//   1. reads are `cache: 'no-store'`, so an export taken right after an edit can
//      never return pre-edit rows;
//   2. a network failure or 5xx flips the serverStatus store, which is what
//      drives the "server unreachable" screen — a 4xx must NOT;
//   3. thrown errors carry the raw Postgres `code`/`details`, so dbError.ts
//      keeps translating foreign-key and unique violations unchanged.
import { Preferences } from '@capacitor/preferences';
import { env } from '../env';
import { setReachable } from '../serverStatus';
import { STORAGE_KEYS } from '../config';
import type { JsonObject, JsonValue } from '../json.types';

const TOKEN_KEY = STORAGE_KEYS.TOKEN;
const REFRESH_KEY = STORAGE_KEYS.REFRESH;

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

interface SessionResponsePayload {
  access_token?: string;
  refresh_token?: string;
}

interface ApiPayloadEnvelope<D = JsonValue> {
  ok?: boolean;
  code?: string;
  message?: string;
  data?: D;
  total?: number;
  meta?: JsonObject;
  error?: {
    code?: string;
    message?: string;
    pg?: { code?: string; details?: string };
  };
}

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
      const raw = (await res.json()) as (ApiPayloadEnvelope<SessionResponsePayload> & SessionResponsePayload);
      const next: SessionResponsePayload | undefined =
        raw && typeof raw === 'object' && 'data' in raw && raw.data
          ? raw.data
          : raw;
      if (!next?.access_token || !next?.refresh_token) return false;
      await setSession({
        access_token: next.access_token,
        refresh_token: next.refresh_token,
      });
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

export type HttpBodyType =
  | object
  | string
  | number
  | boolean
  | null;

export interface RequestOptions<B = HttpBodyType> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: B;
  /** Skip the Authorization header (login endpoints). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

export async function apiFetch<T, B = HttpBodyType>(path: string, options: RequestOptions<B> = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false, signal } = options;

  const send = async (): Promise<Response> => {
    const activeLang = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LANG) || 'ar' : 'ar';
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
  const payload = text ? (JSON.parse(text) as ApiPayloadEnvelope<T>) : null;

  if (!res.ok) {
    const e = payload?.error;
    const directMsg = payload?.message;
    throw new ApiError(
      res.status,
      // Prefer the Postgres SQLSTATE so describeDbError() recognises 23503/23505.
      e?.pg?.code ?? e?.code ?? payload?.code ?? 'unknown',
      e?.message ?? directMsg ?? res.statusText,
      e?.pg?.details,
    );
  }

  // Auto-unwrap new backend architecture envelopes
  if (payload && typeof payload === 'object' && payload.ok === true) {
    if (typeof payload.total === 'number' && Array.isArray(payload.data)) {
      // The same page under every name a caller might ask for, so a screen
      // reading `rows` and one reading `items` both work off one envelope.
      return { 
        data: payload.data,
        items: payload.data,
        rows: payload.data,
        total: payload.total,
        meta: payload.meta 
      } as unknown as T;
    }
    // Map ApiResponse
    return (payload.data !== undefined ? payload.data : payload) as T;
  }

  return payload as T;
}

/**
 * Probe the API. Any HTTP response means the server is serving; only a thrown
 * network error or a 5xx counts as down.
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
