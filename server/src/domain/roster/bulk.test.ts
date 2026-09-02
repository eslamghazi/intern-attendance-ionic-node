// The bulk roster modes. `add` being a TOGGLE is the rule that gets lost when
// this is written directly as SQL — I lost it once already while porting.
import { describe, expect, it } from 'vitest';
import { monthBounds, planBulk, rangeDates, type Slot } from './bulk.js';

const SHIFT = 'shift-a';
const OTHER = 'shift-b';
const slot = (shiftId: string): Slot => ({ memberId: 'm', date: '2026-08-10', shiftId });

describe('planBulk — add', () => {
  const plan = planBulk('add', SHIFT);

  it('deletes only this shift, never another', () => {
    expect(plan.remove(slot(SHIFT))).toBe(true);
    expect(plan.remove(slot(OTHER))).toBe(false);
  });

  it('TOGGLES: a day that already had the shift ends up without it', () => {
    // remove() deletes it, and insert() must then refuse to put it back.
    expect(plan.insert('m', '2026-08-10', true)).toBe(false);
  });

  it('assigns the shift to a day that lacked it', () => {
    expect(plan.insert('m', '2026-08-10', false)).toBe(true);
  });

  it('files the affected members under the month department', () => {
    expect(plan.assignDepartment).toBe(true);
  });
});

describe('planBulk — remove', () => {
  const plan = planBulk('remove', SHIFT);

  it('deletes this shift and nothing else', () => {
    expect(plan.remove(slot(SHIFT))).toBe(true);
    expect(plan.remove(slot(OTHER))).toBe(false);
  });

  it('never inserts', () => {
    expect(plan.insert('m', '2026-08-10', true)).toBe(false);
    expect(plan.insert('m', '2026-08-10', false)).toBe(false);
  });

  it('does NOT touch the department: nothing was added', () => {
    expect(plan.assignDepartment).toBe(false);
  });
});

describe('planBulk — replace', () => {
  const plan = planBulk('replace', SHIFT);

  it('deletes the OTHER shifts, keeping this one', () => {
    expect(plan.remove(slot(OTHER))).toBe(true);
    expect(plan.remove(slot(SHIFT))).toBe(false);
  });

  it('leaves a day that already had it alone, rather than colliding', () => {
    // remove() spared it, so inserting again would violate the unique key.
    expect(plan.insert('m', '2026-08-10', true)).toBe(false);
  });

  it('assigns it to a day that lacked it', () => {
    expect(plan.insert('m', '2026-08-10', false)).toBe(true);
  });
});

describe('rangeDates', () => {
  it('covers the range inclusively', () => {
    expect(rangeDates(2026, 8, 3, 6)).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
    ]);
  });

  it('accepts the bounds in either order', () => {
    expect(rangeDates(2026, 8, 6, 3)).toEqual(rangeDates(2026, 8, 3, 6));
  });

  it('is a single day when the bounds match', () => {
    expect(rangeDates(2026, 8, 9, 9)).toEqual(['2026-08-09']);
  });

  it('clamps to the length of the month', () => {
    // A 31-day drag over February must not invent days.
    expect(rangeDates(2026, 2, 27, 31)).toEqual(['2026-02-27', '2026-02-28']);
    expect(rangeDates(2028, 2, 27, 31)).toContain('2028-02-29'); // leap year
  });

  it('clamps a day below one', () => {
    expect(rangeDates(2026, 8, 0, 2)).toEqual(['2026-08-01', '2026-08-02']);
  });
});

describe('monthBounds', () => {
  it('spans the whole month', () => {
    expect(monthBounds(2026, 8)).toEqual({ first: '2026-08-01', last: '2026-08-31' });
    expect(monthBounds(2026, 2)).toEqual({ first: '2026-02-01', last: '2026-02-28' });
    expect(monthBounds(2028, 2).last).toBe('2028-02-29');
  });

  it('zero-pads a single-digit month', () => {
    expect(monthBounds(2026, 9)).toEqual({ first: '2026-09-01', last: '2026-09-30' });
  });
});
