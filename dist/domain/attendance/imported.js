// An attendance record that arrives in a file, decided the way a live one is.
//
// A faculty may hold attendance on paper for a while — a ward with no signal,
// a month before the app was rolled out — and type it in afterwards. The row
// says WHEN someone came and left; what that MEANS (late? early leave? on
// which date does an overnight check-out fall?) is decided here with the same
// window arithmetic a real check-in uses (windows.ts), so a typed 08:40 and a
// scanned 08:40 are the same record.
//
// The one thing this never decides is whether the slot exists: a row is only
// written onto a rostered (member, date, shift). That is the caller's check,
// and the reason an import cannot invent attendance.
import { isOvernight, placeWindow, toMin } from './windows.js';
import { nextDate } from './windows.js';
import { AttendanceStatus, CheckoutStatus } from '../../common/enums/index.js';
import { cairoInstant } from '../clock.js';
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
/** 'HH:mm' → minutes of day, or null when it is not a time at all. */
export function parseClock(raw) {
    const m = HHMM.exec((raw ?? '').trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
/**
 * Decide the record for one rostered slot from the typed times.
 *
 * No check-in means the member did not come: an absence on a rostered slot,
 * with no times. A check-in is late past the shift's late boundary, exactly
 * as at the door. A check-out before the check-out window opens is an early
 * leave. An overnight shift's check-out that the window places past midnight
 * is stored on the NEXT date — the night nurse who starts at 21:00 leaves on
 * the morning after.
 */
export function importedSlot(shift, date, times, settingsDefaults) {
    // A shift with no explicit windows, on an installation that never set the
    // global shift_start/shift_end, would place "late" at 00:00. Its own start
    // and end are what a person typing the times means by late and early.
    const defaults = {
        shift_start: settingsDefaults.shift_start ?? shift.start_time,
        shift_end: settingsDefaults.shift_end ?? shift.end_time,
    };
    const inMin = parseClock(times.checkIn);
    if (inMin === null) {
        return { status: AttendanceStatus.ABSENT, checkoutStatus: null, checkInAt: null, checkOutAt: null };
    }
    const inWin = placeWindow(shift, inMin, defaults);
    const status = inWin.nowP > inWin.ciLateP ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
    const checkInAt = cairoInstant(inWin.nowP >= 1440 ? nextDate(date) : date, inMin);
    const outMin = parseClock(times.checkOut);
    if (outMin === null)
        return { status, checkoutStatus: null, checkInAt, checkOutAt: null };
    const outWin = placeWindow(shift, outMin, defaults);
    // On an overnight shift, a check-out clock earlier than the check-in clock
    // is the next morning; placeWindow already pushes it past midnight.
    const outDate = outWin.nowP >= 1440 || (isOvernight(shift) && outMin < toMin(shift.start_time)) ? nextDate(date) : date;
    return {
        status,
        checkoutStatus: outWin.nowP < outWin.coOpenP ? CheckoutStatus.EARLY_LEAVE : CheckoutStatus.CHECKED_OUT,
        checkInAt,
        checkOutAt: cairoInstant(outDate, outMin),
    };
}
//# sourceMappingURL=imported.js.map