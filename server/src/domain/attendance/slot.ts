// Which shift does this action belong to?
//
// A member may hold several shifts on one day, so the slot is never taken from
// what the client says — it is derived from the roster, what has already been
// recorded, and which window is open now.
import { isOvernight, placeWindow, toMin, type ShiftRow, type WindowDefaults } from './windows.js';
import {
  decided,
  refuse,
  rejected,
  type AttendanceRecord,
  type AttendanceSettings,
  type BypassState,
  type CheckInDecision,
  type CheckOutDecision,
  type Decided,
} from './types.js';
import {
  AttendanceStatus,
  CheckoutStatus,
  AttendanceRefusalReason,
  AuditEvent,
} from '../../common/enums/index.js';
import type { OpenSlot, SlotContext } from './types.js';
export type { OpenSlot, SlotContext } from './types.js';

/**
 * Pick the shift a check-in applies to.
 *
 * With windows enforced: the shifts not yet checked into whose check-in window
 * is open now, earliest-opening first. Without: simply the earliest-starting
 * shift left, because there is no deadline to respect.
 */
export function decideCheckIn(
  rostered: ShiftRow[],
  todayAttendance: AttendanceRecord[],
  ctx: SlotContext,
): Decided<CheckInDecision> {
  if (!rostered.length) return rejected(refuse(422, 'not_rostered'));

  const checkedIn = new Set(
    todayAttendance.filter((a) => a.checkInAt).map((a) => a.shiftId),
  );
  const candidates = rostered.filter((s) => !checkedIn.has(s.id));
  if (!candidates.length) return rejected(refuse(409, AttendanceRefusalReason.ALREADY_CHECKED_IN));

  const win = (s: ShiftRow) => placeWindow(s, ctx.minutesOfDay, ctx.defaults);

  let shift: ShiftRow;
  if (ctx.settings.enforceShiftWindow) {
    const open = candidates.filter((s) => {
      const w = win(s);
      return w.nowP >= w.ciOpenP && w.nowP <= w.ciCloseP;
    });
    if (!open.length) {
      return rejected(refuse(422, AttendanceRefusalReason.CHECKIN_CLOSED, { audit: AuditEvent.OUTSIDE_WINDOW }));
    }
    // More than one window open at once: take the earliest to open.
    open.sort((a, b) => win(a).ciOpenP - win(b).ciOpenP);
    shift = open[0]!;
  } else {
    shift = [...candidates].sort((a, b) => toMin(a.start_time) - toMin(b.start_time))[0]!;
  }

  const w = win(shift);
  return decided({ shift, status: w.nowP > w.ciLateP ? AttendanceStatus.LATE : AttendanceStatus.PRESENT });
}

/**
 * Pick which open record a check-out closes.
 *
 * Candidates are today's still-open rows PLUS yesterday's still-open OVERNIGHT
 * ones, whose check-out legitimately falls the next morning. Dropping that
 * second group is the classic overnight bug: the night nurse who started at
 * 21:00 has no row dated today to close at 07:00.
 */
export function decideCheckOut(
  todayOpen: OpenSlot[],
  yesterdayOpen: OpenSlot[],
  ctx: SlotContext,
  bypass: Pick<BypassState, 'checkoutWindow'>,
): Decided<CheckOutDecision> {
  const overnightOnly = yesterdayOpen.filter((o) => o.record.shift && isOvernight(o.record.shift));
  const open = [...todayOpen, ...overnightOnly];
  if (!open.length) return rejected(refuse(409, AttendanceRefusalReason.NOT_CHECKED_IN));

  const win = (s: ShiftRow) => placeWindow(s, ctx.minutesOfDay, ctx.defaults);

  let chosen: OpenSlot;
  if (ctx.settings.enforceShiftWindow && !bypass.checkoutWindow) {
    const inWindow = open.filter((o) => {
      // No window information means nothing to enforce — never block on it.
      if (!o.record.shift) return true;
      const w = win(o.record.shift);
      return w.nowP >= w.coOpenP && w.nowP <= w.coCloseP;
    });
    if (!inWindow.length) {
      return rejected(refuse(422, 'checkout_closed', { audit: AuditEvent.OUTSIDE_WINDOW }));
    }
    chosen = inWindow[0]!;
  } else {
    open.sort((a, b) =>
      (a.record.checkInAt ?? '').localeCompare(b.record.checkInAt ?? ''),
    );
    chosen = open[0]!;
  }

  // A member marked "left work" by a failed presence spot-check has had their
  // check-out closed deliberately.
  if (chosen.record.checkoutStatus === CheckoutStatus.LEFT_WORK) {
    return rejected(refuse(422, 'checkout_blocked', { audit: AuditEvent.CHECKOUT_BLOCKED }));
  }

  const w = chosen.record.shift ? win(chosen.record.shift) : null;
  return decided({
    record: chosen.record,
    date: chosen.date,
    shift: chosen.record.shift,
    // Leaving before the window opens is only reachable because a bypass
    // allowed it, and it is recorded as such rather than as a normal exit.
    checkoutStatus: w && w.nowP < w.coOpenP ? CheckoutStatus.EARLY_LEAVE : CheckoutStatus.CHECKED_OUT,
  });
}
