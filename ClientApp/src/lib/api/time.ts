// Authoritative server time (Africa/Cairo). Use this instead of the device
// clock anywhere correctness matters — the phone clock can be manipulated.
import { apiFetch } from './http';
import { cairoDateLabel } from '../date';

export interface ServerNow {
  date: string; // yyyy-mm-dd — effective (possibly frozen) time
  time: string; // HH:mm:ss   — effective (possibly frozen) time
  frozen?: boolean; // true when the caller's clock is pinned (admin frozen-clock)
  real_date?: string; // yyyy-mm-dd — REAL server time, ignores any frozen override
  real_time?: string; // HH:mm:ss   — REAL server time, ignores any frozen override
}

export async function getServerNow(): Promise<ServerNow> {
  const data = await apiFetch<ServerNow>('/time/now');
  // THROW on failure — never invent a time. A bogus sample (e.g. midnight) would
  // corrupt the app-clock offset by many hours. The clock's queryFn retries and
  // keeps the last good offset instead. See src/lib/clock.ts.
  if (!data?.date) throw new Error('server_now unavailable');
  return data;
}

export async function getServerDate(): Promise<string> {
  // Date-only: a device-timezone fallback here is low-risk (only wrong at the
  // midnight boundary if the device date is off), so callers that just need
  // "today" degrade gracefully when the server blips.
  try {
    return (await getServerNow()).date;
  } catch {
    return cairoDateLabel();
  }
}
