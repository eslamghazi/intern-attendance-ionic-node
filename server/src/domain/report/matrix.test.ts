import { describe, it, expect } from 'vitest';
import {
  daysInMonth,
  monthRate,
  representativeStatus,
  statusFill,
  statusMark,
  type DailyStatus,
} from './matrix.js';

describe('representativeStatus', () => {
  it('is null for a day with no slots', () => {
    expect(representativeStatus([])).toBeNull();
  });

  it('returns the only status when there is one', () => {
    expect(representativeStatus(['present'])).toBe('present');
  });

  it('shows the WORST of a mixed day — the cell exists to surface a problem', () => {
    expect(representativeStatus(['present', 'absent'])).toBe('absent');
    expect(representativeStatus(['present', 'late'])).toBe('late');
    expect(representativeStatus(['pending', 'present'])).toBe('pending');
  });

  it('orders the whole severity chain', () => {
    const worstFirst: DailyStatus[] = ['absent', 'late', 'left_work', 'early_leave', 'pending', 'present'];
    for (let i = 0; i < worstFirst.length; i++) {
      // Each status beats everything after it, in either argument order.
      for (let j = i + 1; j < worstFirst.length; j++) {
        expect(representativeStatus([worstFirst[i]!, worstFirst[j]!])).toBe(worstFirst[i]);
        expect(representativeStatus([worstFirst[j]!, worstFirst[i]!])).toBe(worstFirst[i]);
      }
    }
  });
});

describe('statusFill / statusMark', () => {
  it('gives every status a fill and a mark', () => {
    const all: DailyStatus[] = ['present', 'late', 'early_leave', 'absent', 'left_work', 'pending'];
    for (const s of all) {
      expect(statusFill(s)).toMatch(/^#[0-9a-f]{6}$/i);
      expect(statusMark(s)).not.toBe('');
    }
  });

  it('gives an empty day neither', () => {
    expect(statusFill(null)).toBeUndefined();
    expect(statusMark(null)).toBe('');
  });

  it('marks are distinct, so a printed file still reads without colour', () => {
    const all: DailyStatus[] = ['present', 'late', 'early_leave', 'absent', 'left_work', 'pending'];
    expect(new Set(all.map(statusMark)).size).toBe(all.length);
  });
});

describe('daysInMonth', () => {
  it('handles 31, 30 and February', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it('handles a leap February', () => {
    expect(daysInMonth(2028, 2)).toBe(29);
  });
});

describe('monthRate', () => {
  it('counts present and late as attended', () => {
    expect(monthRate({ 1: ['present'], 2: ['late'] })).toEqual({ attended: 2, rostered: 2 });
  });

  it('counts absences against the member', () => {
    expect(monthRate({ 1: ['present'], 2: ['absent'] })).toEqual({ attended: 1, rostered: 2 });
  });

  it('EXCLUDES pending from both sides — a slot nobody could have attended yet is not a miss', () => {
    expect(monthRate({ 1: ['present'], 2: ['pending'] })).toEqual({ attended: 1, rostered: 1 });
  });

  it('counts every slot of a multi-shift day', () => {
    expect(monthRate({ 1: ['present', 'absent'] })).toEqual({ attended: 1, rostered: 2 });
  });

  it('is zero over zero for an empty month, not a division', () => {
    expect(monthRate({})).toEqual({ attended: 0, rostered: 0 });
  });
});
