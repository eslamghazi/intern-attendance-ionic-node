// Applying one shift across a range of days, for everyone a filter matches.
//
// The three modes look similar and are not:
//
//   add       assign the shift — but on a day that ALREADY carries it, take it
//             off instead. Same toggle as tapping the cell, so dragging over a
//             range you half-filled does not double it.
//   remove    take it off every day it is assigned in the range.
//   replace   make it the ONLY shift on every day in the range.
//
// `add` being a toggle is the part that gets lost. Written as "delete then
// insert everywhere", it re-adds what it just removed and the toggle silently
// becomes "always on" — which is how a member ends up rostered for a shift they
// were removed from.
//
// The rules are here rather than in SQL so they can be stated once and tested;
// src/data/roster.ts turns the plan into one statement.
/**
 * What each mode does, as two predicates over the range's CURRENT contents.
 *
 * `hadShift` is whether that (member, date) carried the shift BEFORE this
 * operation — which is why the caller must read it before deleting anything.
 */
export function planBulk(mode, shiftId) {
    switch (mode) {
        case 'add':
            return {
                // Only this shift is touched.
                remove: (e) => e.shiftId === shiftId,
                // Days that already had it were just removed and stay removed: that is
                // the toggle. Days that lacked it receive it.
                insert: (_m, _d, hadShift) => !hadShift,
                assignDepartment: true,
            };
        case 'remove':
            return {
                remove: (e) => e.shiftId === shiftId,
                insert: () => false,
                // Nothing was added, so there is nothing to file under a department.
                assignDepartment: false,
            };
        case 'replace':
            return {
                // Every OTHER shift in the range goes.
                remove: (e) => e.shiftId !== shiftId,
                // Days that already had it keep it — `remove` never touched them, so
                // re-inserting would collide. Days that lacked it receive it.
                insert: (_m, _d, hadShift) => !hadShift,
                assignDepartment: true,
            };
    }
}
/** The dates a day range covers, as 'yyyy-MM-dd'. Order of the bounds is free. */
export function rangeDates(year, month, fromDay, toDay) {
    const pad = (n) => String(n).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const from = Math.max(1, Math.min(fromDay, toDay));
    const to = Math.min(lastDay, Math.max(fromDay, toDay));
    const out = [];
    for (let d = from; d <= to; d++)
        out.push(`${year}-${pad(month)}-${pad(d)}`);
    return out;
}
/** First and last day of a month, as 'yyyy-MM-dd'. */
export function monthBounds(year, month) {
    const pad = (n) => String(n).padStart(2, '0');
    return {
        first: `${year}-${pad(month)}-01`,
        last: `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`,
    };
}
//# sourceMappingURL=bulk.js.map