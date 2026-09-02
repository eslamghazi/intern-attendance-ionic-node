// THE single app clock. Everything time-related in the app reads from here so
// the displayed time, the "today" date, and the shift-window checks all agree
// and all come from the AUTHORITATIVE server (Africa/Cairo) — never the device
// clock, which a member can manipulate. A small offset is synced from the
// server periodically (see useClockSync) and the app ticks locally in between.
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getServerNow, type ServerNow } from './api/time';

const CAIRO = 'Africa/Cairo';

/** ms to add to the device clock to get the EFFECTIVE server time (which may be
 *  a frozen test clock). Used for display + shift-window logic. */
let offsetMs = 0;
/** ms to add to the device clock to get the REAL server time, ignoring any
 *  frozen-clock override. Used for security-sensitive real-time windows (the QR
 *  location-bypass window) so they can't be beaten by changing the device clock
 *  and aren't broken by a frozen test clock. */
let realOffsetMs = 0;
/** True when the signed-in caller's clock is pinned (admin frozen-clock test). */
let frozen = false;
/** Device epoch (ms) captured at the last successful sample — used to HOLD the
 *  instant when the clock is frozen so the seconds don't tick forward. */
let sampleAtEpoch = 0;

/** A Cairo wall-clock -> comparable pseudo-epoch (timezone cancels on subtract). */
const pseudo = (date: string, time: string) => Date.parse(`${date}T${time}Z`);

function cairoParts(d: Date): { date: string; time: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: CAIRO,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}` };
}

/** Current app instant. Normally the device clock corrected by the server
 *  offset (ticks locally between syncs). When the caller's clock is FROZEN, we
 *  hold the sampled instant instead of ticking, so a pinned time stays put and
 *  is only re-affirmed by the periodic re-sync. */
export function appNow(): Date {
  const base = frozen ? sampleAtEpoch : Date.now();
  return new Date(base + offsetMs);
}

/** REAL server-synced instant, IGNORING any frozen-clock override. Tamper-proof
 *  (synced from the server, not the device clock) and unaffected by the frozen
 *  test clock. Use ONLY for real-time security windows like the QR bypass. */
export function appRealNow(): Date {
  return new Date(Date.now() + realOffsetMs);
}

/** Today's date (yyyy-mm-dd) in Cairo, from the app clock. */
export function appToday(): string {
  return cairoParts(appNow()).date;
}

/** Minutes-of-day in Cairo, from the app clock. */
export function appNowMinutes(): number {
  const [h, m] = cairoParts(appNow()).time.split(':').map(Number);
  return h * 60 + m;
}

export const CLOCK_KEY = ['app-clock'];
const SYNC_MS = 30 * 1000; // re-sync every half minute

/**
 * The shared clock queryFn. It samples the authoritative server time and sets
 * the module offset RIGHT HERE — inside the queryFn, before React Query updates
 * the cache and before any observer re-renders. That ordering is essential:
 * consumers (CheckInPage's window/bypass checks, etc.) read `appNow()` during
 * render, so the offset must already be correct by the time they re-render on
 * the new sample. (Setting it in a post-render useEffect left them one render
 * behind on the device clock — the source of "time wrong / bypass not working".)
 *
 * `server_now` returns the pinned instant when the CALLER's clock is frozen, so
 * whatever the server hands back IS the effective time — real or frozen. We only
 * record whether it was frozen so appNow() can hold it steady instead of ticking.
 *
 * On failure it THROWS (React Query then retries) instead of returning a bogus
 * time, so the offset simply stays at its last good value rather than lurching
 * to a wrong one.
 */
export async function sampleClock(): Promise<ServerNow> {
  const s = await getServerNow(); // throws if the server is unreachable
  const nowEpoch = Date.now();
  const dev = cairoParts(new Date(nowEpoch));
  const devPseudo = pseudo(dev.date, dev.time);
  offsetMs = pseudo(s.date, s.time) - devPseudo;
  // Real offset ignores the frozen override (falls back to effective time on an
  // older server that doesn't return real_date/real_time).
  realOffsetMs = pseudo(s.real_date ?? s.date, s.real_time ?? s.time) - devPseudo;
  frozen = !!s.frozen;
  sampleAtEpoch = nowEpoch;
  return s;
}

/**
 * Mount once near the app root: OWNS the clock fetch. Gate it on `ready`
 * (auth resolved) so the FIRST sample is taken with the signed-in identity —
 * an member's frozen clock, if set — rather than as anon during the auth
 * bootstrap (which returned real time and made the clock disagree between the
 * first page and later ones). Re-syncs every SYNC_MS.
 */
export function useClockSync(ready: boolean): void {
  useQuery({
    queryKey: CLOCK_KEY,
    queryFn: sampleClock,
    enabled: ready,
    staleTime: SYNC_MS,
    refetchInterval: ready ? SYNC_MS : false,
    retry: 3,
    refetchOnWindowFocus: true,
  });
}

/** Subscribe to clock syncs WITHOUT driving a fetch — the owner (useClockSync,
 *  auth-gated) is the only fetcher, so a passive consumer can never trigger an
 *  early anon sample. Re-renders whenever the shared sample updates. */
export function useClockSubscribe(): void {
  useQuery({ queryKey: CLOCK_KEY, queryFn: sampleClock, enabled: false });
}

/** Subscribe to clock syncs and tick every second. Returns the app instant. */
export function useNow(): Date {
  useClockSubscribe();
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return appNow();
}
