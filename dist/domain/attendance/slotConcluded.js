// "Can this roster slot still be checked into?"
//
// A member who has not checked in is only ABSENT once it is too late for them
// to check in — after that shift's check-out window closes. Until then the slot is
// PENDING: they might walk in five minutes from now. Getting this wrong is not
// cosmetic; it decides whether a report shows an absence against a student who
// has done nothing wrong yet.
//
// WHY IT IS A FUNCTION AND NOT A PROJECTED SQL COLUMN
//
// Every caller applies it per row, to rows it is already returning — never in a
// WHERE, a GROUP BY or an aggregate. So evaluating it in the database would save
// no rows and no round trips; it would only move a rule with edge cases
// (overnight shifts, windows not enforced, slots with no shift) somewhere it
// cannot be tested without a live connection.
//
// It needs the shift, which those queries already join, and the two global
// defaults from app_settings — both fetched once per call, not per row.
import { toMin } from './windows.js';
import { DEFAULT_CHECKIN_LEAD_MIN, DEFAULT_CHECKOUT_SPAN_MIN, MINUTES_PER_DAY, } from '../../config/constants.js';
const DAY = MINUTES_PER_DAY;
/** `yyyy-MM-dd` plus whole days, without a timezone anywhere near it. */
function addDays(date, days) {
    if (days === 0)
        return date;
    const [y, m, d] = date.split('-').map(Number);
    // UTC on purpose: this is calendar arithmetic on a plain date, and going
    // through local time is how a date shifts by one under a DST boundary.
    const at = new Date(Date.UTC(y, m - 1, d + days));
    return at.toISOString().slice(0, 10);
}
/**
 * Has the window for this slot closed?
 *
 * Ported statement for statement from the SQL it replaces — including the two
 * behaviours that look like accidents and are not:
 *
 *   * With shift windows NOT enforced there is no deadline before midnight, so
 *     the whole DATE has to pass. A member may check in any time that day.
 *   * A slot with no shift is treated the same way, because there is no window
 *     to close.
 *
 * `shift` is the roster row's shift, or null. `clock` is Cairo — never the
 * server's local time, and never the caller's.
 */
export function slotConcluded(args) {
    const { date, shift, enforceShiftWindow, defaults, clock } = args;
    if (!shift || !enforceShiftWindow)
        return date < clock.date;
    const ciLate = toMin(shift.checkin_late ?? defaults.shiftStart);
    const coOpen = toMin(shift.checkout_open ?? defaults.shiftEnd);
    // `((x % DAY) + DAY) % DAY` rather than `x % DAY`: a late boundary before
    // 00:30 puts the lead time on the previous day, and a plain remainder of a
    // negative number is negative in both SQL and JavaScript.
    const ciOpen = shift.checkin_open != null
        ? toMin(shift.checkin_open)
        : (((ciLate - DEFAULT_CHECKIN_LEAD_MIN) % DAY) + DAY) % DAY;
    const coClose = shift.checkout_close != null
        ? toMin(shift.checkout_close)
        : (((coOpen + DEFAULT_CHECKOUT_SPAN_MIN) % DAY) + DAY) % DAY;
    // Anchored at check-in open: a close time that reads EARLIER on the clock
    // belongs to the next day. This is what makes an overnight shift work —
    // 22:00 to 06:00 closes on the following date, not eight hours before it
    // opened.
    const slotEnd = coClose < ciOpen ? coClose + DAY : coClose;
    const endDate = addDays(date, Math.floor(slotEnd / DAY));
    if (clock.date !== endDate)
        return clock.date > endDate;
    return clock.minutesOfDay >= slotEnd % DAY;
}
//# sourceMappingURL=slotConcluded.js.map