// The attendance rate. The rule that a still-running shift counts as neither
// attendance nor absence is subtle and easy to "simplify" back into a bug, so
// it is pinned here.
import { describe, expect, it } from 'vitest';
import { attendanceRate, dayStat, monthStats, type SlotCounts } from './rate.js';

const counts = (over: Partial<SlotCounts> = {}): SlotCounts => ({
  attended: 0,
  late: 0,
  absent: 0,
  pending: 0,
  attendedOpen: 0,
  attendedSettled: 0,
  ...over,
});

describe('attendanceRate', () => {
  it('measures over settled slots only', () => {
    // 8 came, 2 did not, out of 10 finished slots.
    expect(attendanceRate(counts({ attendedSettled: 8, absent: 2 }))).toEqual({
      percent: 80,
      basis: 'settled',
    });
  });

  it('does NOT let a still-running shift inflate a real result', () => {
    // 8 of 10 finished slots attended, plus 300 arrivals on shifts still open.
    // The open ones must not count, or the rate reads ~99%.
    expect(
      attendanceRate(counts({ attendedSettled: 8, absent: 2, attendedOpen: 300 })).percent,
    ).toBe(80);
  });

  it('falls back to arrivals-so-far when NOTHING has settled', () => {
    // Two check-ins at 8am out of 400 rostered today: 0.5%, measured over the
    // open slots, and flagged as such.
    expect(attendanceRate(counts({ attendedOpen: 2, pending: 398 }))).toEqual({
      percent: 1,
      basis: 'open',
    });
  });

  it('stops using the open fallback the moment one slot settles', () => {
    const open = attendanceRate(counts({ attendedOpen: 2, pending: 2 }));
    expect(open.basis).toBe('open');
    const mixed = attendanceRate(counts({ attendedOpen: 2, pending: 2, absent: 1 }));
    expect(mixed.basis).toBe('settled');
    expect(mixed.percent).toBe(0); // 0 attended of 1 settled
  });

  it('reports "none" rather than 0% when there is nothing at all', () => {
    // 0% would read as "nobody came"; the caller shows a dash instead.
    expect(attendanceRate(counts())).toEqual({ percent: 0, basis: 'none' });
  });

  it('is 100% when every settled slot was attended', () => {
    expect(attendanceRate(counts({ attendedSettled: 12, absent: 0 })).percent).toBe(100);
  });

  it('is 0% when every settled slot was missed', () => {
    expect(attendanceRate(counts({ attendedSettled: 0, absent: 7 }))).toEqual({
      percent: 0,
      basis: 'settled',
    });
  });

  it('rounds to the nearest whole percent', () => {
    expect(attendanceRate(counts({ attendedSettled: 2, absent: 1 })).percent).toBe(67);
    expect(attendanceRate(counts({ attendedSettled: 1, absent: 2 })).percent).toBe(33);
  });
});

describe('dayStat', () => {
  it('applies the same rule per day', () => {
    const running = dayStat({
      day: 3,
      attended: 5,
      absent: 0,
      pending: 20,
      settledAttended: 0,
      openAttended: 5,
    });
    expect(running).toMatchObject({ day: 3, settled: 0, open: 25, rate: 20 });

    const finished = dayStat({
      day: 4,
      attended: 18,
      absent: 2,
      pending: 0,
      settledAttended: 18,
      openAttended: 0,
    });
    expect(finished).toMatchObject({ settled: 20, open: 0, rate: 90 });
  });
});

describe('monthStats', () => {
  const base = {
    perBranch: [],
    perGroup: [],
    perShift: [],
    perBranchStatus: [],
    days: [],
    singleDay: false,
  };

  it('derives present from attended minus late', () => {
    const s = monthStats({ ...counts({ attended: 30, late: 4, attendedSettled: 30 }), ...base });
    expect(s.present).toBe(26);
    expect(s.late).toBe(4);
  });

  it('never reports a negative present count', () => {
    // The two are counted by separate filters; a disagreement must not surface
    // as a negative number on the dashboard.
    const s = monthStats({ ...counts({ attended: 3, late: 5 }), ...base });
    expect(s.present).toBe(0);
  });

  it('drops the daily trend when a single day is picked', () => {
    const days = [{ day: 1, attended: 1, absent: 0, pending: 0, settledAttended: 1, openAttended: 0 }];
    expect(monthStats({ ...counts(), ...base, days, singleDay: true }).perDay).toEqual([]);
    expect(monthStats({ ...counts(), ...base, days, singleDay: false }).perDay).toHaveLength(1);
  });

  it('reports settled as attended-and-finished plus absent', () => {
    const s = monthStats({ ...counts({ attendedSettled: 9, absent: 3, pending: 40 }), ...base });
    expect(s.settled).toBe(12);
    expect(s.rateBasis).toBe('settled');
  });
});
