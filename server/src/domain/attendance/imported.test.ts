import { describe, expect, it } from 'vitest';
import { importedSlot, parseClock } from './imported.js';
import type { ShiftRow } from './windows.js';
import { AttendanceStatus, CheckoutStatus } from '../../common/enums/index.js';

const morning: ShiftRow = {
  id: 's-m',
  name: 'صباحي',
  start_time: '08:00',
  end_time: '14:00',
  checkin_open: '07:30',
  checkin_late: '08:15',
  checkin_close: '09:15',
  checkout_open: '14:00',
  checkout_close: '17:00',
};

const night: ShiftRow = {
  id: 's-n',
  name: 'ليلي',
  start_time: '20:00',
  end_time: '08:00',
  checkin_open: '19:30',
  checkin_late: '20:15',
  checkin_close: '21:15',
  checkout_open: '08:00',
  checkout_close: '11:00',
};

const defaults = { shift_start: '08:00', shift_end: '14:00' };
// 2026-07-10 is Cairo summer time (UTC+3).
const DATE = '2026-07-10';

describe('parseClock', () => {
  it('reads HH:mm and nothing else', () => {
    expect(parseClock('08:40')).toBe(520);
    expect(parseClock('8:05')).toBe(485);
    expect(parseClock('')).toBeNull();
    expect(parseClock('25:00')).toBeNull();
    expect(parseClock('8.40')).toBeNull();
    expect(parseClock(undefined)).toBeNull();
  });
});

describe('importedSlot', () => {
  it('no check-in is an absence with no times', () => {
    expect(importedSlot(morning, DATE, { checkIn: null, checkOut: '14:10' }, defaults)).toEqual({
      status: AttendanceStatus.ABSENT,
      checkoutStatus: null,
      checkInAt: null,
      checkOutAt: null,
    });
  });

  it('on time is present; past the late boundary is late — the door\'s own rule', () => {
    expect(importedSlot(morning, DATE, { checkIn: '08:10', checkOut: null }, defaults).status).toBe(AttendanceStatus.PRESENT);
    expect(importedSlot(morning, DATE, { checkIn: '08:16', checkOut: null }, defaults).status).toBe(AttendanceStatus.LATE);
  });

  it('stores the Cairo wall clock as the instant it was', () => {
    const slot = importedSlot(morning, DATE, { checkIn: '08:10', checkOut: '14:20' }, defaults);
    // 08:10 Cairo summer time is 05:10Z.
    expect(slot.checkInAt).toBe('2026-07-10T05:10:00.000Z');
    expect(slot.checkOutAt).toBe('2026-07-10T11:20:00.000Z');
    expect(slot.checkoutStatus).toBe(CheckoutStatus.CHECKED_OUT);
  });

  it('leaving before the check-out window opens is an early leave', () => {
    expect(importedSlot(morning, DATE, { checkIn: '08:00', checkOut: '12:30' }, defaults).checkoutStatus).toBe(CheckoutStatus.EARLY_LEAVE);
  });

  it('an overnight check-out falls on the next morning', () => {
    const slot = importedSlot(night, DATE, { checkIn: '19:50', checkOut: '08:05' }, defaults);
    expect(slot.status).toBe(AttendanceStatus.PRESENT);
    expect(slot.checkInAt).toBe('2026-07-10T16:50:00.000Z');
    expect(slot.checkOutAt).toBe('2026-07-11T05:05:00.000Z');
    expect(slot.checkoutStatus).toBe(CheckoutStatus.CHECKED_OUT);
  });

  it('with no windows anywhere, the shift\'s own start and end decide late and early', () => {
    const bare: ShiftRow = {
      id: 's-b', name: 'bare', start_time: '08:00', end_time: '14:00',
      checkin_open: null, checkin_late: null, checkin_close: null, checkout_open: null, checkout_close: null,
    };
    const none = { shift_start: null, shift_end: null };
    expect(importedSlot(bare, DATE, { checkIn: '07:55', checkOut: '14:05' }, none)).toMatchObject({
      status: AttendanceStatus.PRESENT,
      checkoutStatus: CheckoutStatus.CHECKED_OUT,
    });
    expect(importedSlot(bare, DATE, { checkIn: '08:30', checkOut: '12:00' }, none)).toMatchObject({
      status: AttendanceStatus.LATE,
      checkoutStatus: CheckoutStatus.EARLY_LEAVE,
    });
  });

  it('a check-in with a bad check-out keeps the check-in and drops the check-out', () => {
    const slot = importedSlot(morning, DATE, { checkIn: '08:00', checkOut: 'x' }, defaults);
    expect(slot.checkInAt).not.toBeNull();
    expect(slot.checkOutAt).toBeNull();
    expect(slot.checkoutStatus).toBeNull();
  });
});
