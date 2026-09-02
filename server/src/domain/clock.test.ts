// Cairo time. Egypt reintroduced daylight saving in 2023, so "UTC+2" is no
// longer a safe assumption anywhere in this system — the offset is +3 through
// the summer, which is most of the academic year's second term.
import { describe, expect, it } from 'vitest';
import { cairoDate, cairoNow, cairoTime } from './clock.js';
import { isValidNationalId, parseNationalId } from './identity/nationalId.js';

describe('cairoNow', () => {
  it('is UTC+2 in winter', () => {
    // 2026-01-15 22:30 UTC -> 2026-01-16 00:30 Cairo
    const at = new Date('2026-01-15T22:30:00Z');
    expect(cairoNow(at)).toEqual({ date: '2026-01-16', minutesOfDay: 30 });
  });

  it('is UTC+3 in summer — Egypt observes DST again since 2023', () => {
    // 2026-07-15 22:30 UTC -> 2026-07-16 01:30 Cairo (not 00:30)
    const at = new Date('2026-07-15T22:30:00Z');
    expect(cairoNow(at)).toEqual({ date: '2026-07-16', minutesOfDay: 90 });
  });

  it('rolls the DATE over at Cairo midnight, not UTC midnight', () => {
    // 21:30 UTC in winter is already tomorrow in Cairo.
    expect(cairoDate(new Date('2026-01-15T22:00:00Z'))).toBe('2026-01-16');
    // ...but 21:00 UTC is not.
    expect(cairoDate(new Date('2026-01-15T21:00:00Z'))).toBe('2026-01-15');
  });

  it('formats the time zero-padded', () => {
    expect(cairoTime(new Date('2026-01-15T06:05:09Z'))).toBe('08:05:09');
  });
});

describe('parseNationalId', () => {
  it('derives the date-of-birth password for a 1900s id', () => {
    // 2 = 1900s, 90-01-01
    expect(parseNationalId('29001011234567')).toEqual({
      valid: true,
      dobPassword: '01011990',
    });
  });

  it('derives it for a 2000s id', () => {
    expect(parseNationalId('30512251234567')).toEqual({
      valid: true,
      dobPassword: '25122005',
    });
  });

  it('rejects the wrong length, non-digits and a bad century', () => {
    expect(isValidNationalId('2900101123456')).toBe(false);
    expect(isValidNationalId('2900101123456X')).toBe(false);
    expect(isValidNationalId('49001011234567')).toBe(false);
  });

  it('rejects an impossible month or day', () => {
    expect(isValidNationalId('29013011234567')).toBe(false);
    expect(isValidNationalId('29001321234567')).toBe(false);
  });

  it('trims surrounding whitespace', () => {
    expect(parseNationalId(' 29001011234567 ').valid).toBe(true);
  });
});
