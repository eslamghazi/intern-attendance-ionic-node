// The shift-window maths decides two things that must agree: whether the API
// will still accept a check-in, and whether a report may call the slot an
// absence. Overnight shifts are where that goes wrong, so they are most of
// what is tested here.
import { describe, expect, it } from 'vitest';
import {
  isOvernight,
  placeWindow,
  previousDate,
  toClock,
  toMin,
  type ShiftRow,
} from './windows.js';

const DEFAULTS = { shift_start: '07:00', shift_end: '17:00' };

/** A shift with only the fields the window maths reads. */
function shift(over: Partial<ShiftRow>): ShiftRow {
  return {
    id: 's',
    name: 'S',
    checkin_open: null,
    checkin_late: null,
    checkin_close: null,
    checkout_open: null,
    checkout_close: null,
    start_time: null,
    end_time: null,
    ...over,
  };
}

describe('toMin / toClock', () => {
  it('parses HH:mm and HH:mm:ss the same', () => {
    expect(toMin('07:30')).toBe(450);
    expect(toMin('07:30:59')).toBe(450);
  });

  it('treats null as midnight', () => {
    expect(toMin(null)).toBe(0);
  });

  it('wraps past midnight when formatting', () => {
    expect(toClock(1440 + 90)).toBe('01:30');
    expect(toClock(-30)).toBe('23:30');
  });
});

describe('isOvernight', () => {
  it('is true when the end is at or before the start', () => {
    expect(isOvernight(shift({ start_time: '20:00', end_time: '08:00' }))).toBe(true);
    expect(isOvernight(shift({ start_time: '08:00', end_time: '08:00' }))).toBe(true);
  });

  it('is false for a normal day shift', () => {
    expect(isOvernight(shift({ start_time: '08:00', end_time: '16:00' }))).toBe(false);
  });
});

describe('placeWindow — a normal day shift', () => {
  const day = shift({
    checkin_open: '07:00',
    checkin_late: '08:00',
    checkin_close: '09:00',
    checkout_open: '16:00',
    checkout_close: '19:00',
  });

  it('keeps the boundaries in order', () => {
    const w = placeWindow(day, 8 * 60, DEFAULTS);
    expect(w.ciOpenP).toBe(420);
    expect(w.ciLateP).toBe(480);
    expect(w.ciCloseP).toBe(540);
    expect(w.coOpenP).toBe(960);
    expect(w.coCloseP).toBe(1140);
  });

  it('marks an arrival after the late boundary as late', () => {
    const onTime = placeWindow(day, 7 * 60 + 45, DEFAULTS);
    const late = placeWindow(day, 8 * 60 + 15, DEFAULTS);
    expect(onTime.nowP > onTime.ciLateP).toBe(false);
    expect(late.nowP > late.ciLateP).toBe(true);
  });
});

describe('placeWindow — an overnight shift (20:00 -> 08:00)', () => {
  const night = shift({
    checkin_open: '19:30',
    checkin_late: '20:00',
    checkin_close: '21:00',
    checkout_open: '08:00',
    checkout_close: '10:00',
    start_time: '20:00',
    end_time: '08:00',
  });

  it('places the morning check-out AFTER the evening check-in', () => {
    const w = placeWindow(night, 20 * 60, DEFAULTS);
    // 08:00 belongs to the next day, so it must sort after 19:30.
    expect(w.coOpenP).toBeGreaterThan(w.ciOpenP);
    expect(w.coOpenP).toBe(8 * 60 + 1440);
    expect(w.coCloseP).toBe(10 * 60 + 1440);
  });

  it('puts 02:00 INSIDE the shift, not before it', () => {
    const w = placeWindow(night, 2 * 60, DEFAULTS);
    expect(w.nowP).toBe(2 * 60 + 1440);
    expect(w.nowP).toBeGreaterThan(w.ciOpenP);
    expect(w.nowP).toBeLessThan(w.coOpenP);
  });

  it('accepts a 09:00 check-out the next morning', () => {
    const w = placeWindow(night, 9 * 60, DEFAULTS);
    expect(w.nowP >= w.coOpenP && w.nowP <= w.coCloseP).toBe(true);
  });

  it('refuses a check-out at 11:00, after the window closed', () => {
    const w = placeWindow(night, 11 * 60, DEFAULTS);
    expect(w.nowP <= w.coCloseP).toBe(false);
  });

  it('refuses both windows at 19:00, before check-in opens', () => {
    // The anchor is check-in open (19:30), so 19:00 is placed a day FORWARD —
    // read as "19:00 after this shift ended", not "30 minutes before it starts".
    // That looks odd in isolation, which is why the assertion is on the two
    // range checks the API actually makes rather than on the placed value: both
    // must refuse, and they do.
    const w = placeWindow(night, 19 * 60, DEFAULTS);
    const checkInOpen = w.nowP >= w.ciOpenP && w.nowP <= w.ciCloseP;
    const checkOutOpen = w.nowP >= w.coOpenP && w.nowP <= w.coCloseP;
    expect(checkInOpen).toBe(false);
    expect(checkOutOpen).toBe(false);
  });

  it('opens check-in at 19:45, inside the pre-start grace', () => {
    const w = placeWindow(night, 19 * 60 + 45, DEFAULTS);
    expect(w.nowP >= w.ciOpenP && w.nowP <= w.ciCloseP).toBe(true);
  });
});

describe('placeWindow — defaults', () => {
  it('opens check-in 30 minutes before the late boundary', () => {
    const w = placeWindow(shift({ checkin_late: '08:00' }), 0, DEFAULTS);
    expect(w.ciOpenP).toBe(7 * 60 + 30);
    expect(w.ciCloseP).toBe(9 * 60);
  });

  it('closes check-out 180 minutes after it opens', () => {
    const w = placeWindow(shift({ checkout_open: '16:00' }), 0, DEFAULTS);
    expect(w.coCloseP).toBe(19 * 60);
  });

  it('falls back to the app-wide shift_start / shift_end', () => {
    const w = placeWindow(shift({}), 0, DEFAULTS);
    expect(w.ciLateP).toBe(7 * 60);
    expect(w.coOpenP).toBe(17 * 60);
  });

  it('handles a default check-in open that would land before midnight', () => {
    // 00:15 late boundary -> open at 23:45 the previous evening; the anchor is
    // that 23:45, so nothing may sort before it.
    const w = placeWindow(shift({ checkin_late: '00:15' }), 0, DEFAULTS);
    expect(w.ciOpenP).toBe(23 * 60 + 45);
    expect(w.ciLateP).toBeGreaterThan(w.ciOpenP);
  });
});

describe('previousDate', () => {
  it('steps back one day', () => {
    expect(previousDate('2026-08-29')).toBe('2026-08-28');
  });

  it('crosses a month boundary', () => {
    expect(previousDate('2026-09-01')).toBe('2026-08-31');
  });

  it('crosses a year boundary', () => {
    expect(previousDate('2026-01-01')).toBe('2025-12-31');
  });

  it('handles a leap day', () => {
    expect(previousDate('2028-03-01')).toBe('2028-02-29');
  });
});
