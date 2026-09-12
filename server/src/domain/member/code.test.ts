// The member code rules, which were a SQL trigger with no tests.
import { describe, it, expect } from 'vitest';
import {
  codeMatchesCohort,
  composeMemberCode,
  memberCodePrefix,
  memberCodeSerial,
  reissueNeeded,
} from './code.js';

describe('memberCodePrefix', () => {
  it('is always six characters: four of year, two of institution', () => {
    expect(memberCodePrefix(2026, 1)).toBe('202601');
    expect(memberCodePrefix(2026, 0)).toBe('202600');
    expect(memberCodePrefix(2026, 99)).toBe('202699');
  });

  it('pads a short year rather than shifting the serial', () => {
    // A three-digit year is nonsense, but a five-character prefix would put the
    // serial in the wrong place for every code in that cohort.
    expect(memberCodePrefix(999, 1)).toHaveLength(6);
  });
});

describe('composeMemberCode', () => {
  it('pads the serial to four digits', () => {
    expect(composeMemberCode(2026, 1, 1)).toBe('2026010001');
    expect(composeMemberCode(2026, 1, 42)).toBe('2026010042');
    expect(composeMemberCode(2026, 1, 9999)).toBe('2026019999');
  });

  it('grows past four digits rather than wrapping', () => {
    // Reusing 0001 for the ten-thousandth member would be far worse than a
    // longer code.
    expect(composeMemberCode(2026, 1, 10000)).toBe('20260110000');
    expect(composeMemberCode(2026, 1, 123456)).toBe('202601123456');
  });

  it('keeps the prefix readable at the front', () => {
    expect(composeMemberCode(2026, 7, 3).startsWith('202607')).toBe(true);
  });
});

describe('memberCodeSerial', () => {
  it('reads the serial back out', () => {
    expect(memberCodeSerial('2026010001')).toBe(1);
    expect(memberCodeSerial('2026010042')).toBe(42);
    expect(memberCodeSerial('20260110000')).toBe(10000);
  });

  it('round-trips with composeMemberCode', () => {
    for (const n of [1, 9, 10, 999, 1000, 9999, 10000]) {
      expect(memberCodeSerial(composeMemberCode(2026, 1, n))).toBe(n);
    }
  });

  it('returns null for anything that is not a serial', () => {
    expect(memberCodeSerial(null)).toBeNull();
    expect(memberCodeSerial('')).toBeNull();
    expect(memberCodeSerial('202601')).toBeNull(); // prefix only
    expect(memberCodeSerial('2026ABCD')).toBeNull();
  });
});

describe('codeMatchesCohort', () => {
  it('matches on the first six characters only', () => {
    expect(codeMatchesCohort('2026010001', 2026, 1)).toBe(true);
    expect(codeMatchesCohort('2026019999', 2026, 1)).toBe(true);
  });

  it('does not match another year or institution', () => {
    expect(codeMatchesCohort('2026010001', 2027, 1)).toBe(false);
    expect(codeMatchesCohort('2026010001', 2026, 2)).toBe(false);
  });

  it('a missing code matches nothing', () => {
    expect(codeMatchesCohort(null, 2026, 1)).toBe(false);
    expect(codeMatchesCohort('', 2026, 1)).toBe(false);
  });
});

describe('reissueNeeded', () => {
  const cohort = { year: 2026, institutionCode: 1 };

  it('issues a code to a member who has none', () => {
    expect(reissueNeeded(null, cohort)).toBe(true);
  });

  it('leaves a code that already belongs to this cohort', () => {
    // The one that matters: a member moved between groups in the SAME year
    // keeps the code already printed on this year's rosters.
    expect(reissueNeeded('2026010001', cohort)).toBe(false);
  });

  it('reissues when the member moves to another cohort', () => {
    expect(reissueNeeded('2025010001', cohort)).toBe(true);
    expect(reissueNeeded('2026020001', cohort)).toBe(true);
  });

  it('assigns nothing when the group has no academic year', () => {
    // `if v_year is null then return new` — no code, and an existing one is
    // left alone rather than cleared.
    expect(reissueNeeded(null, { year: null, institutionCode: 1 })).toBe(false);
    expect(reissueNeeded('2026010001', { year: null, institutionCode: 1 })).toBe(false);
  });

  it('assigns nothing when there is no group at all', () => {
    expect(reissueNeeded(null, null)).toBe(false);
    expect(reissueNeeded('2026010001', null)).toBe(false);
  });
});
