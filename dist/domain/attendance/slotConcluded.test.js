// The rule that decides whether a missing check-in is an ABSENCE or still
// PENDING. It had no tests at all while it was a SQL function.
import { describe, it, expect } from 'vitest';
import { slotConcluded } from './slotConcluded.js';
const shift = (over = {}) => ({
    id: 's1',
    name: 'Morning',
    checkin_open: '07:00',
    checkin_late: '08:00',
    checkin_close: null,
    checkout_open: '14:00',
    checkout_close: '17:00',
    start_time: '08:00',
    end_time: '16:00',
    ...over,
});
const defaults = { shiftStart: '08:00', shiftEnd: '16:00' };
const ask = (date, clockDate, minutesOfDay, over = {}, enforce = true) => slotConcluded({
    date,
    shift: over === null ? null : shift(over),
    enforceShiftWindow: enforce,
    defaults,
    clock: { date: clockDate, minutesOfDay },
});
describe('an ordinary daytime shift', () => {
    it('is pending before the check-out window closes', () => {
        // 16:00 on the day, window closes 17:00.
        expect(ask('2026-09-11', '2026-09-11', 16 * 60)).toBe(false);
    });
    it('concludes exactly at the close, not a minute later', () => {
        expect(ask('2026-09-11', '2026-09-11', 17 * 60 - 1)).toBe(false);
        expect(ask('2026-09-11', '2026-09-11', 17 * 60)).toBe(true);
    });
    it('is pending all of an earlier morning', () => {
        expect(ask('2026-09-11', '2026-09-11', 0)).toBe(false);
    });
    it('has concluded on any later day', () => {
        expect(ask('2026-09-11', '2026-09-12', 0)).toBe(true);
    });
    it('has NOT concluded on an earlier day — a future slot is not an absence', () => {
        // The case that matters most: a roster published for next month must not
        // report every one of its slots as already missed.
        expect(ask('2026-09-11', '2026-09-01', 23 * 60)).toBe(false);
    });
});
describe('an overnight shift', () => {
    // 22:00 → 06:00. Check-out closes at 07:00 the NEXT day.
    const night = { checkin_open: '22:00', checkin_late: '23:00', checkout_open: '05:00', checkout_close: '07:00' };
    it('is still pending at 23:59 on its own date', () => {
        expect(ask('2026-09-11', '2026-09-11', 23 * 60 + 59, night)).toBe(false);
    });
    it('is still pending in the small hours of the following morning', () => {
        expect(ask('2026-09-11', '2026-09-12', 3 * 60, night)).toBe(false);
    });
    it('concludes at 07:00 the next day', () => {
        expect(ask('2026-09-11', '2026-09-12', 7 * 60 - 1, night)).toBe(false);
        expect(ask('2026-09-11', '2026-09-12', 7 * 60, night)).toBe(true);
    });
    it('has concluded by the day after that', () => {
        expect(ask('2026-09-11', '2026-09-13', 0, night)).toBe(true);
    });
});
describe('when the shift does not state its windows', () => {
    it('opens check-in 30 minutes before the late boundary', () => {
        // checkin_late 08:00 → opens 07:30; checkout_open 14:00 → closes 17:00.
        const s = { checkin_open: null, checkout_close: null };
        expect(ask('2026-09-11', '2026-09-11', 17 * 60 - 1, s)).toBe(false);
        expect(ask('2026-09-11', '2026-09-11', 17 * 60, s)).toBe(true);
    });
    it('falls back to the global shift_start / shift_end', () => {
        const s = { checkin_open: null, checkin_late: null, checkout_open: null, checkout_close: null };
        // shift_end 16:00 → check-out closes 19:00.
        expect(ask('2026-09-11', '2026-09-11', 19 * 60 - 1, s)).toBe(false);
        expect(ask('2026-09-11', '2026-09-11', 19 * 60, s)).toBe(true);
    });
    it('wraps a lead time that crosses midnight instead of going negative', () => {
        // checkin_late 00:10 → opens 23:40 the previous day. A plain remainder
        // would give -20 and invert the overnight test below it.
        const s = { checkin_open: null, checkin_late: '00:10', checkout_open: '02:00', checkout_close: null };
        // checkout_open 02:00 → closes 05:00, which is AFTER ciOpen 23:40 only by
        // wrapping, so the slot ends the next day.
        expect(ask('2026-09-11', '2026-09-11', 23 * 60 + 59, s)).toBe(false);
        expect(ask('2026-09-11', '2026-09-12', 5 * 60, s)).toBe(true);
    });
});
describe('when windows are not enforced, or there is no shift', () => {
    it('needs the whole date to pass', () => {
        expect(ask('2026-09-11', '2026-09-11', 23 * 60 + 59, {}, false)).toBe(false);
        expect(ask('2026-09-11', '2026-09-12', 0, {}, false)).toBe(true);
    });
    it('treats a slot with no shift the same way', () => {
        expect(ask('2026-09-11', '2026-09-11', 23 * 60 + 59, null)).toBe(false);
        expect(ask('2026-09-11', '2026-09-12', 0, null)).toBe(true);
    });
});
describe('calendar arithmetic', () => {
    it('crosses a month boundary', () => {
        const night = { checkin_open: '22:00', checkin_late: '23:00', checkout_open: '05:00', checkout_close: '07:00' };
        expect(ask('2026-09-30', '2026-10-01', 6 * 60, night)).toBe(false);
        expect(ask('2026-09-30', '2026-10-01', 7 * 60, night)).toBe(true);
    });
    it('crosses a year boundary', () => {
        const night = { checkin_open: '22:00', checkin_late: '23:00', checkout_open: '05:00', checkout_close: '07:00' };
        expect(ask('2026-12-31', '2027-01-01', 6 * 60, night)).toBe(false);
        expect(ask('2026-12-31', '2027-01-01', 7 * 60, night)).toBe(true);
    });
    it('handles a leap day', () => {
        const night = { checkin_open: '22:00', checkin_late: '23:00', checkout_open: '05:00', checkout_close: '07:00' };
        expect(ask('2028-02-28', '2028-02-29', 6 * 60, night)).toBe(false);
        expect(ask('2028-02-29', '2028-03-01', 7 * 60, night)).toBe(true);
    });
});
//# sourceMappingURL=slotConcluded.test.js.map