import { describe, it, expect } from 'vitest';
import { attendanceOutcome, outcomeAttended, outcomeCounts, } from './outcome.js';
import { ATTENDANCE_OUTCOME, OUTCOME_LEGEND_ORDER } from '../../config/constants.js';
const slot = (over = {}) => ({
    hasRoster: true,
    concluded: true,
    checkInAt: null,
    checkInStatus: null,
    checkOutAt: null,
    checkoutStatus: null,
    ...over,
});
const IN = '2026-09-11T07:58:00Z';
const OUT = '2026-09-11T15:04:00Z';
describe('nobody arrived', () => {
    it('is OFF when there was no roster — not an absence', () => {
        // The difference that matters most to a member reading their own history:
        // a day they were never expected must not look like a day they missed.
        expect(attendanceOutcome(slot({ hasRoster: false }))).toBe('off');
    });
    it('is OFF even once the day has passed, if they were never expected', () => {
        expect(attendanceOutcome(slot({ hasRoster: false, concluded: true }))).toBe('off');
    });
    it('is UPCOMING while the window is still open', () => {
        expect(attendanceOutcome(slot({ concluded: false }))).toBe('upcoming');
    });
    it('is ABSENT once the window has closed', () => {
        expect(attendanceOutcome(slot({ concluded: true }))).toBe('absent');
    });
});
describe('arrived on time', () => {
    const on = { checkInAt: IN, checkInStatus: 'present' };
    it('still inside', () => {
        expect(attendanceOutcome(slot(on))).toBe('present_open');
    });
    it('checked out', () => {
        expect(attendanceOutcome(slot({ ...on, checkOutAt: OUT }))).toBe('present_out');
    });
    it('checked out early', () => {
        expect(attendanceOutcome(slot({ ...on, checkOutAt: OUT, checkoutStatus: 'early_leave' }))).toBe('present_early');
    });
    it('left work — recorded with NO check-out time', () => {
        // The scheduler sets this on a slot nobody checked out of, so the row has a
        // departure status and no departure time. Reading checkOutAt first would
        // call this "still inside" forever.
        expect(attendanceOutcome(slot({ ...on, checkoutStatus: 'left_work' }))).toBe('present_left');
    });
    it('checked_out as a status, with no time recorded', () => {
        expect(attendanceOutcome(slot({ ...on, checkoutStatus: 'checked_out' }))).toBe('present_out');
    });
});
describe('arrived late', () => {
    const late = { checkInAt: IN, checkInStatus: 'late' };
    it('carries the lateness through every departure', () => {
        expect(attendanceOutcome(slot(late))).toBe('late_open');
        expect(attendanceOutcome(slot({ ...late, checkOutAt: OUT }))).toBe('late_out');
        expect(attendanceOutcome(slot({ ...late, checkOutAt: OUT, checkoutStatus: 'early_leave' }))).toBe('late_early');
        expect(attendanceOutcome(slot({ ...late, checkoutStatus: 'left_work' }))).toBe('late_left');
    });
    it('does not lose the lateness when a slot has no roster', () => {
        // A manual record, or a check-in on a day nobody rostered. They were still
        // late, and the history should say so rather than calling it an off day.
        expect(attendanceOutcome(slot({ ...late, hasRoster: false }))).toBe('late_open');
    });
});
describe('worst-first on the departure axis', () => {
    it('left_work beats a recorded check-out time', () => {
        expect(attendanceOutcome(slot({
            checkInAt: IN, checkInStatus: 'present',
            checkOutAt: OUT, checkoutStatus: 'left_work',
        }))).toBe('present_left');
    });
    it('early_leave beats a plain check-out', () => {
        expect(attendanceOutcome(slot({
            checkInAt: IN, checkInStatus: 'present',
            checkOutAt: OUT, checkoutStatus: 'early_leave',
        }))).toBe('present_early');
    });
});
describe('rate arithmetic', () => {
    it('counts every arrival as attended, however they left', () => {
        for (const o of ['present_open', 'present_out', 'present_early', 'present_left',
            'late_open', 'late_out', 'late_early', 'late_left']) {
            expect(outcomeAttended(o)).toBe(true);
        }
    });
    it('does not count an absence, an off day or an upcoming slot as attended', () => {
        for (const o of ['absent', 'off', 'upcoming']) {
            expect(outcomeAttended(o)).toBe(false);
        }
    });
    it('leaves off days and upcoming slots OUT of the denominator', () => {
        // Counting either makes a rate read low for reasons that are nobody's fault.
        expect(outcomeCounts('off')).toBe(false);
        expect(outcomeCounts('upcoming')).toBe(false);
        expect(outcomeCounts('absent')).toBe(true);
        expect(outcomeCounts('present_out')).toBe(true);
    });
});
describe('the legend covers the vocabulary', () => {
    it('every outcome has a mark, a fill and a label', () => {
        for (const key of Object.keys(ATTENDANCE_OUTCOME)) {
            const style = ATTENDANCE_OUTCOME[key];
            expect(style.mark).not.toBe('');
            expect(style.fill).toMatch(/^#[0-9a-f]{6}$/i);
            expect(style.labelKey).toMatch(/^outcome\./);
        }
    });
    it('the legend lists every outcome exactly once — no gaps, no strays', () => {
        // The failure this prevents: adding an outcome and shipping a legend that
        // does not explain it, which is worse than no legend at all.
        expect([...OUTCOME_LEGEND_ORDER].sort()).toEqual(Object.keys(ATTENDANCE_OUTCOME).sort());
    });
    it('marks are distinct, so a printed report reads without colour', () => {
        const marks = Object.values(ATTENDANCE_OUTCOME).map((s) => s.mark);
        expect(new Set(marks).size).toBe(marks.length);
    });
});
//# sourceMappingURL=outcome.test.js.map