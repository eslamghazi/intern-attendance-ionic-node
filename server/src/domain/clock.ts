// The operational clock.
//
// Everything in this system is reasoned about in Africa/Cairo, and Egypt has
// observed daylight saving again since 2023 — so "UTC+2" is wrong for roughly
// half the academic year. The offset is never assumed; it is always derived
// from the zone.
//
// The process timezone is UTC (see docker-compose.yml) and must stay that way:
// nothing here reads the host's local zone.
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import { APP_TIMEZONE } from '../config/constants.js';

/** Re-exported under the name the domain uses. See config/constants.ts. */
export const CAIRO = APP_TIMEZONE;

export interface CairoNow {
  /** yyyy-MM-dd */
  date: string;
  minutesOfDay: number;
}

/**
 * Date and minutes-of-day in Cairo. Pass an explicit instant to reason about a
 * fixed time — an admin-frozen clock, or a test.
 */
export function cairoNow(at: Date = new Date()): CairoNow {
  const date = formatInTimeZone(at, CAIRO, 'yyyy-MM-dd');
  const hour = Number(formatInTimeZone(at, CAIRO, 'HH'));
  const minute = Number(formatInTimeZone(at, CAIRO, 'mm'));
  return { date, minutesOfDay: hour * 60 + minute };
}

/** 'yyyy-MM-dd' for an instant, in Cairo. */
export function cairoDate(at: Date = new Date()): string {
  return formatInTimeZone(at, CAIRO, 'yyyy-MM-dd');
}

/**
 * 'HH:mm' in Cairo for a stored timestamp, or '' when there is none.
 *
 * For reports, where a blank cell is the right way to say "did not check out" —
 * a missing time must not become 'Invalid Date' or the epoch.
 */
export function cairoClock(at: string | Date | null | undefined): string {
  if (!at) return '';
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? '' : formatInTimeZone(d, CAIRO, 'HH:mm');
}

/**
 * The instant a Cairo wall-clock moment is, as an ISO timestamp.
 *
 * For times that arrive as a date and 'HH:mm' — an attendance file typed by
 * a person in Cairo — and must be stored as the timestamptz a real check-in
 * writes. DST is decided by the zone for THAT date, never assumed.
 */
export function cairoInstant(date: string, minutesOfDay: number): string {
  const hh = String(Math.floor(minutesOfDay / 60)).padStart(2, '0');
  const mm = String(minutesOfDay % 60).padStart(2, '0');
  return fromZonedTime(`${date}T${hh}:${mm}:00`, CAIRO).toISOString();
}

/** 'HH:mm:ss' for an instant, in Cairo. */
export function cairoTime(at: Date = new Date()): string {
  return formatInTimeZone(at, CAIRO, 'HH:mm:ss');
}
