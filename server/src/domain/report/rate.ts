// What "attendance rate" means.
//
// This is the number the whole dashboard is judged on, and getting it wrong is
// not a rounding error — it is the difference between "everybody showed up" and
// "the day has not happened yet".
//
// A rostered slot is in one of three states:
//
//   settled + attended   the check-out window has closed and they came
//   settled + absent     the window has closed and they never came
//   open                 the window is still open; nobody is late for it yet
//
// The rate is measured over SETTLED slots only. Two check-ins at 8am out of 400
// shifts rostered for today is not 100% attendance, and the other 398 are not
// absences — they are pending, and reported as such.
//
// ONE exception, and it is what makes the filters useful: when a filtered view
// contains nothing settled at all — a single day whose shift is still running,
// a group that only works that shift — there is no finished slot to measure and
// hiding the number tells the admin nothing. Then, and only then, the rate is
// "how many of the expected have arrived so far". The moment the same view also
// holds finished slots the open ones drop out again, so an early arrival can
// never inflate a real result.

import type { DayCounts, DayStat, MonthInput, MonthStats, Rate, RateBasis, SlotCounts } from './types.js';
export type { DayCounts, DayStat, MonthInput, MonthStats, Rate, RateBasis, SlotCounts } from './types.js';
/**
 * The rate, and what it was measured against.
 *
 * `none` means there is genuinely nothing to measure — the caller should show
 * a dash, never "0%", because zero would read as "nobody came".
 */
export function attendanceRate(c: SlotCounts): Rate {
  const settled = c.attendedSettled + c.absent;
  const open = c.pending + c.attendedOpen;

  if (settled > 0) {
    return { percent: Math.round((c.attendedSettled / settled) * 100), basis: 'settled' };
  }
  if (open > 0) {
    return { percent: Math.round((c.attendedOpen / open) * 100), basis: 'open' };
  }
  return { percent: 0, basis: 'none' };
}

export function dayStat(d: DayCounts): DayStat {
  const settled = d.settledAttended + d.absent;
  const open = d.pending + d.openAttended;
  return {
    day: d.day,
    attended: d.attended,
    absent: d.absent,
    pending: d.pending,
    settled,
    open,
    rate: attendanceRate({
      attended: d.attended,
      late: 0,
      absent: d.absent,
      pending: d.pending,
      attendedOpen: d.openAttended,
      attendedSettled: d.settledAttended,
    }).percent,
  };
}

/** Assemble the dashboard figure from the counts. */
export function monthStats(input: MonthInput): MonthStats {
  const rate = attendanceRate(input);
  return {
    attended: input.attended,
    // Guarded: `late` is counted by a separate filter, and a disagreement
    // between the two must not surface as a negative "present".
    present: Math.max(0, input.attended - input.late),
    late: input.late,
    absent: input.absent,
    pending: input.pending,
    attendedOpen: input.attendedOpen,
    attendedSettled: input.attendedSettled,
    settled: input.attendedSettled + input.absent,
    rateBasis: rate.basis,
    rate: rate.percent,
    perBranch: input.perBranch,
    perGroup: input.perGroup,
    perShift: input.perShift,
    perBranchStatus: input.perBranchStatus,
    perDay: input.singleDay ? [] : input.days.map(dayStat),
  };
}
