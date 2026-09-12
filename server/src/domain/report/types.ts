// The shapes a report is computed from.
import type { STATUS_STYLE } from '../../config/constants.js';

/** Raw counts, as the database returns them. */
export interface SlotCounts {
  /** Check-ins in the period, settled or not. */
  attended: number;
  /** Of those, the late ones. */
  late: number;
  /** Settled slots nobody checked into. */
  absent: number;
  /** Open slots nobody has checked into yet. */
  pending: number;
  /** Check-ins on slots that are still running. */
  attendedOpen: number;
  /** Check-ins on slots that have finished. */
  attendedSettled: number;
}

/** What the rate was measured against, so the UI can say which. */
export type RateBasis = 'settled' | 'open' | 'none';

export interface Rate {
  percent: number;
  basis: RateBasis;
}

/** One day of the trend chart. A day is its own filtered view, so it follows
 *  exactly the same rule. */
export interface DayStat {
  day: number;
  attended: number;
  absent: number;
  pending: number;
  /** Slots with a verdict: attended-and-finished + absent. */
  settled: number;
  /** Still-open slots in total, checked in or not. */
  open: number;
  rate: number;
}

export interface DayCounts {
  day: number;
  attended: number;
  absent: number;
  pending: number;
  settledAttended: number;
  openAttended: number;
}

export interface MonthStats extends SlotCounts {
  /** attended minus late. */
  present: number;
  /** Slots the period can actually judge. */
  settled: number;
  rateBasis: RateBasis;
  rate: number;
  perBranch: { branch_id: string; value: number }[];
  perGroup: { group_id: string; value: number }[];
  perShift: { shift_id: string; value: number }[];
  perBranchStatus: { branch_id: string; present: number; late: number; absent: number }[];
  perDay: DayStat[];
}

export interface MonthInput extends SlotCounts {
  perBranch: MonthStats['perBranch'];
  perGroup: MonthStats['perGroup'];
  perShift: MonthStats['perShift'];
  perBranchStatus: MonthStats['perBranchStatus'];
  days: DayCounts[];
  /** A single day was picked, so there is no trend to draw. */
  singleDay: boolean;
}
