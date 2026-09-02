// Client-side helpers to decide which shifts are "open right now" for check-in /
// check-out. Uses the same minute-placement as the server (overnight shifts are
// anchored at check-in open) so the picker matches what the server will accept.
// The server re-validates, so this is only for the UX list.
/** The shift fields needed to compute windows (Shift and TodayShift both match). */
export interface ShiftWindowFields {
  start_time: string;
  end_time: string;
  checkin_open: string | null;
  checkin_close: string | null;
  checkout_open: string | null;
  checkout_close: string | null;
}

const toMin = (t?: string | null): number => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

function open(openT: string | null, closeT: string | null, nowMin: number, anchorMin: number): boolean {
  const place = (m: number) => (m < anchorMin ? m + 1440 : m);
  const o = place(toMin(openT));
  const c = place(toMin(closeT));
  const n = place(nowMin);
  return n >= o && n <= c;
}

/** True when the shift crosses midnight (ends on/before it starts), e.g. a night
 *  shift 20:00 -> 08:00. Such a shift is checked into on its start day and
 *  checked out of the NEXT calendar day. */
export function isOvernight(sh: ShiftWindowFields): boolean {
  return toMin(sh.end_time) <= toMin(sh.start_time);
}

export function checkinOpenNow(sh: ShiftWindowFields, nowMin: number): boolean {
  const start = sh.checkin_open ?? sh.start_time;
  const anchor = toMin(start);
  return open(start, sh.checkin_close ?? sh.start_time, nowMin, anchor);
}

export function checkoutOpenNow(sh: ShiftWindowFields, nowMin: number): boolean {
  const anchor = toMin(sh.checkin_open ?? sh.start_time);
  return open(sh.checkout_open ?? sh.end_time, sh.checkout_close ?? sh.end_time, nowMin, anchor);
}
