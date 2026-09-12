// The monthly attendance matrix: one row per member, one column per day.
//
// A member can hold SEVERAL slots on one day — two shifts, or a shift plus a
// manual correction — so a day cell is a list of statuses, not one. Two rules
// turn that list into something a grid can show, and both are here because the
// screen and the exported file must agree on them exactly. Rendering a cell one
// way on screen and another in the file is the kind of difference nobody spots
// until a report is disputed.

import {
  ATTENDED_STATUSES,
  STATUS_SEVERITY,
  STATUS_STYLE,
} from '../../config/constants.js';

/** The statuses a single rostered slot can be in. */
export type DailyStatus = keyof typeof STATUS_STYLE;

/** Worst-first — see config/constants.ts for why a mixed day shows its problem. */
const SEVERITY: readonly DailyStatus[] = STATUS_SEVERITY;

/** The one status that stands for a day. */
export function representativeStatus(list: readonly DailyStatus[]): DailyStatus | null {
  if (!list.length) return null;
  return SEVERITY.find((s) => list.includes(s)) ?? list[0]!;
}

export function statusFill(status: DailyStatus | null): string | undefined {
  return status ? STATUS_STYLE[status].fill : undefined;
}

export function statusMark(status: DailyStatus | null): string {
  return status ? STATUS_STYLE[status].mark : '';
}

/** Days in a month — `new Date(y, m, 0)` is the last day of month `m`. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** `present` and `late` both mean the member turned up. */
const ATTENDED: readonly DailyStatus[] = ATTENDED_STATUSES;

/**
 * Attended slots over rostered slots, for one member's month.
 *
 * `pending` is excluded from the denominator on purpose: a slot nobody could
 * have attended yet is not a slot they missed, and counting it makes every rate
 * read low until the month ends.
 */
export function monthRate(days: Record<string, DailyStatus[] | undefined>): {
  attended: number;
  rostered: number;
} {
  let attended = 0;
  let rostered = 0;
  for (const list of Object.values(days)) {
    for (const s of list ?? []) {
      if (s === 'pending') continue;
      rostered++;
      if (ATTENDED.includes(s)) attended++;
    }
  }
  return { attended, rostered };
}
