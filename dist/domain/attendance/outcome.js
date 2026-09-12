// What actually happened in one slot, as ONE value.
//
// Attendance has two independent axes: how the member arrived (on time, late,
// not at all) and how they left (checked out, left early, walked off, still
// inside). A screen that shows only the first says "present" for a member who
// vanished at lunch, and a screen that shows two separate badges makes the
// reader do the combining — differently each time, and never in an export.
//
// So the pair is named. Every combination that can occur has a code, a label
// and a mark, and everything that displays attendance renders from this one
// table: the member's history, the admin grids, the xlsx and the PDF. A legend
// is generated from the same table, so it cannot describe marks that are no
// longer used or miss ones that are.
import { AttendanceStatus, CheckoutStatus } from '../../common/enums/index.js';
/**
 * The one outcome for a slot.
 *
 * ORDER MATTERS. Arrival is decided first, because "did they turn up" dominates:
 * a slot nobody attended has no departure to describe. Only then is the
 * departure read, and `left_work` beats `early_leave` beats a normal check-out —
 * worst-first, the same rule the day cells use.
 */
export function attendanceOutcome(slot) {
    const arrived = slot.checkInAt !== null;
    if (!arrived) {
        // No attendance at all. Whether that is an absence depends entirely on
        // whether they were expected and whether the moment has passed.
        if (!slot.hasRoster)
            return 'off';
        return slot.concluded ? 'absent' : 'upcoming';
    }
    const late = slot.checkInStatus === AttendanceStatus.LATE;
    // `left_work` is set by the scheduler on a slot nobody checked out of, so it
    // is checked BEFORE checkOutAt — the row has a departure status and no
    // departure time, and that combination is the whole point of the status.
    if (slot.checkoutStatus === CheckoutStatus.LEFT_WORK) {
        return late ? 'late_left' : 'present_left';
    }
    if (slot.checkoutStatus === CheckoutStatus.EARLY_LEAVE) {
        return late ? 'late_early' : 'present_early';
    }
    if (slot.checkOutAt !== null || slot.checkoutStatus === CheckoutStatus.CHECKED_OUT) {
        return late ? 'late_out' : 'present_out';
    }
    // Arrived and still inside — which is normal mid-shift and a problem after.
    return late ? 'late_open' : 'present_open';
}
/** Did the member turn up at all? Used for attendance rates. */
export function outcomeAttended(outcome) {
    return outcome.startsWith('present_') || outcome.startsWith('late_');
}
/** Does this outcome count toward a rate's denominator? */
export function outcomeCounts(outcome) {
    // `off` was never expected and `upcoming` has not happened; counting either
    // makes every rate read low for reasons that are nobody's fault.
    return outcome !== 'off' && outcome !== 'upcoming';
}
//# sourceMappingURL=outcome.js.map