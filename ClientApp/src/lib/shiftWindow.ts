// When is a rostered shift actually OVER?
//
// This is the client-side twin of `winFor()` in the record-attendance function:
// same fallbacks, same "anchor at check-in open" placement. Keeping them in step
// matters because the answer decides two things that must agree — whether the
// server would still accept a check-in, and whether the UI is allowed to call
// the slot an absence.
import { SHIFT } from './config';

/** Just the window columns; any shift row satisfies this. */
export interface ShiftWindowTimes {
  checkin_open: string | null;
  checkin_late: string | null;
  checkout_open: string | null;
  checkout_close: string | null;
}

const toMin = (t: string): number => {
  const [h, m] = t.split(':');
  return (Number(h) || 0) * 60 + (Number(m) || 0);
};

/** Wrap a minute count into a real clock time (mirrors the server's toClock). */
const wrap = (m: number): number => ((m % 1440) + 1440) % 1440;

/**
 * Minutes after midnight OF THE ROSTER DATE at which the shift's check-out
 * window closes — the moment the slot is finished for good.
 *
 * Goes past 1440 for an overnight shift (21:00 -> 09:00 next morning), which is
 * exactly what the caller needs: the slot belongs to the date it started on but
 * ends on the following one.
 */
export function slotEndMinutes(sh: ShiftWindowTimes): number {
  const ciLate = wrap(toMin(sh.checkin_late ?? SHIFT.defaultStart));
  const coOpen = wrap(toMin(sh.checkout_open ?? SHIFT.defaultEnd));
  const ciOpen = wrap(sh.checkin_open ? toMin(sh.checkin_open) : ciLate - 30);
  const coClose = wrap(sh.checkout_close ? toMin(sh.checkout_close) : coOpen + 180);
  // Everything is placed on one rising scale anchored at check-in open, so a
  // window that reads "earlier" on the clock is understood as the next day.
  return coClose < ciOpen ? coClose + 1440 : coClose;
}

/** `yyyy-mm-dd` plus n days. */
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Has the slot rostered on `date` finished, as of `nowDate` + `nowMinutes`
 * (both from the app clock — server time, Africa/Cairo)?
 *
 * Before this is true the member can still walk in and check in, so the slot
 * must NOT be reported as an absence yet.
 */
export function slotConcluded(
  sh: ShiftWindowTimes,
  date: string,
  nowDate: string,
  nowMinutes: number,
): boolean {
  const end = slotEndMinutes(sh);
  const endDate = end >= 1440 ? addDays(date, Math.floor(end / 1440)) : date;
  if (nowDate !== endDate) return nowDate > endDate;
  return nowMinutes >= end % 1440;
}
