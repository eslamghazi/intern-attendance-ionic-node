// Shift-window arithmetic for the attendance recorder.
//
// Extracted from record-attendance so the awkward part — overnight shifts — is
// in one place with a name, rather than inline in a 470-line handler.
//
// The problem: a shift can run 20:00 -> 08:00. Comparing raw minutes-of-day
// then puts "now = 02:00" BEFORE the shift's start, and a next-morning check-out
// looks out of window. The fix is to place every boundary on one monotonic
// scale anchored at check-in open: anything earlier in the day than the anchor
// is pushed a day forward (+1440).

export interface ShiftRow {
  id: string;
  name: string;
  checkin_open: string | null;
  checkin_late: string | null;
  checkin_close: string | null;
  checkout_open: string | null;
  checkout_close: string | null;
  start_time: string | null;
  end_time: string | null;
}

/** 'HH:mm[:ss]' -> minutes since midnight. */
export function toMin(t?: string | null): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** minutes -> 'HH:mm', wrapped into a single day. */
export function toClock(m: number): string {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
}

/** True when the shift crosses midnight. */
export function isOvernight(sh: ShiftRow): boolean {
  return toMin(sh.end_time) <= toMin(sh.start_time);
}

export interface WindowDefaults {
  /** app_settings.shift_start — used when a shift has no explicit check-in-late. */
  shift_start: string | null;
  /** app_settings.shift_end — used when a shift has no explicit check-out-open. */
  shift_end: string | null;
}

export interface PlacedWindow {
  ciOpenP: number;
  ciLateP: number;
  ciCloseP: number;
  coOpenP: number;
  coCloseP: number;
  nowP: number;
}

/**
 * All five boundaries plus "now", placed on the anchored scale.
 *
 * Defaults, unchanged from the original: check-in opens 30 minutes before the
 * late boundary and closes 60 after it; check-out closes 180 minutes after it
 * opens.
 */
export function placeWindow(
  sh: ShiftRow,
  minutesOfDay: number,
  defaults: WindowDefaults,
): PlacedWindow {
  const ciLate = sh.checkin_late ?? defaults.shift_start;
  const coOpen = sh.checkout_open ?? defaults.shift_end;
  const ciOpen = sh.checkin_open ?? toClock(toMin(ciLate) - 30);
  const ciClose = sh.checkin_close ?? toClock(toMin(ciLate) + 60);
  const coClose = sh.checkout_close ?? toClock(toMin(coOpen) + 180);

  const anchor = toMin(ciOpen);
  const place = (m: number) => (m < anchor ? m + 1440 : m);

  return {
    ciOpenP: place(toMin(ciOpen)),
    ciLateP: place(toMin(ciLate)),
    ciCloseP: place(toMin(ciClose)),
    coOpenP: place(toMin(coOpen)),
    coCloseP: place(toMin(coClose)),
    nowP: place(minutesOfDay),
  };
}

/** The previous calendar day for a 'yyyy-MM-dd' label. Noon avoids DST edges. */
export function previousDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
