// The check-in / check-out use case: owns the transaction, calls the domain for
// every decision, and calls the data layer for every read and write.
//
// It contains no rules of its own. If you are about to add an `if` here that
// decides whether something is allowed, it belongs in src/domain/attendance.
import type { DbContext } from '../db/context.js';
import { asService } from '../db/context.js';
import * as data from '../data/attendance.js';
import { cairoNow } from '../domain/clock.js';
import { previousDate } from '../domain/attendance/windows.js';
import { bypassSnapshot, checkGates, resolveBypass } from '../domain/attendance/gates.js';
import { decideCheckIn, decideCheckOut, type OpenSlot } from '../domain/attendance/slot.js';
import {
  refuse,
  type CheckPayload,
  type Refusal,
} from '../domain/attendance/types.js';
import { BUCKETS, decodeBase64Image, putObject } from '../storage/objects.js';

export interface CheckResult {
  ok: true;
  type: 'check_in' | 'check_out';
  status: string;
  distance: number;
  shift: string | null;
}

/** Thrown so the route can map it onto the `{ reason }` body the client reads. */
export class AttendanceRefused extends Error {
  constructor(readonly refusal: Refusal) {
    super(refusal.reason);
    this.name = 'AttendanceRefused';
  }
}

/**
 * Store the capture, if the deployment keeps them. Never blocks attendance: a
 * storage outage must not stop a student checking in.
 *
 * The shift id is part of the path so two shifts on one day cannot overwrite
 * each other's photo.
 */
async function storeProbe(
  tx: DbContext,
  payload: CheckPayload,
  keep: boolean,
  profileId: string,
  memberId: string,
  date: string,
  shiftId: string,
): Promise<string | null> {
  if (!keep || !payload.probeBase64) return payload.probePath;
  try {
    const bytes = decodeBase64Image(payload.probeBase64);
    if (!bytes) return payload.probePath;
    const naming = await data.probeNaming(tx, profileId);
    const folder = naming?.groupYear ? String(naming.groupYear) : 'group';
    const code = String(naming?.code ?? memberId).replace(/[^A-Za-z0-9_-]+/g, '_');
    const path = `${folder}/${code}/${date}-${shiftId}-${payload.type}.jpg`;
    await putObject({
      bucket: BUCKETS.probes,
      path,
      body: bytes,
      contentType: 'image/jpeg',
      owner: profileId,
      tx, // never open a second transaction — see PutOptions.tx
    });
    return path;
  } catch {
    return payload.probePath;
  }
}

/**
 * The single validated write path for attendance.
 *
 * Everything runs in ONE transaction: a single-use QR can no longer be burned
 * by a check-in that then fails to record, which used to leave the member
 * holding a spent token and unable to try again.
 */
export async function recordAttendance(
  callerId: string,
  payload: CheckPayload,
): Promise<CheckResult> {
  return asService(async (tx) => {
    const member = await data.loadMemberContext(tx, callerId);
    if (!member || !member.isActive) throw new AttendanceRefused(refuse(403, 'not_a_member'));

    const settings = await data.loadSettings(tx);
    if (!settings) throw new AttendanceRefused(refuse(500, 'no_settings'));

    // An admin-pinned clock replaces the real one for ALL time reasoning below,
    // and the member is unaware of it.
    const effectiveNow = member.frozenAt ? new Date(member.frozenAt) : new Date();
    const { date, minutesOfDay } = cairoNow(effectiveNow);

    // A token presented with this request is validated (and burned) before the
    // bypass state is resolved, because it may be what clears the location gate.
    let qrAccepted = false;
    if (payload.qrToken) {
      const probe = resolveBypass({ settings: settings, member: member, now: effectiveNow });
      if (!probe.location) {
        if (!probe.qrEnabled) throw new AttendanceRefused(refuse(422, 'qr_disabled'));
        qrAccepted = await data.redeemQrToken(tx, {
          token: payload.qrToken,
          branchId: member.branchId,
          memberId: member.id,
          date: cairoNow().date, // the token's own day, never the frozen one
          requiresMember: settings.qrRequiresMember,
        });
        if (!qrAccepted) {
          await data.writeAudit(tx, callerId, 'out_of_range', { qr: 'invalid' });
          throw new AttendanceRefused(refuse(422, 'qr_invalid'));
        }
      }
    }

    const bypass = resolveBypass({
      settings: settings,
      member: member,
      now: effectiveNow,
      qrAccepted,
    });

    // The geofence is the one gate that needs the database, so it is fetched
    // only when the location gate is actually live.
    const geofence = bypass.location
      ? null
      : await data.geofenceCheck(tx, member.branchId, payload.lat, payload.lng);

    const gates = checkGates(payload, settings, bypass, member, geofence);
    if (gates.audit) await data.writeAudit(tx, callerId, gates.audit.event, gates.audit.detail);
    if (gates.refusal) throw new AttendanceRefused(gates.refusal);

    const distance = gates.distance;
    const snapshot = bypassSnapshot(bypass);
    const ctx = {
      settings: settings,
      minutesOfDay,
      defaults: { shift_start: settings.shiftStart, shift_end: settings.shiftEnd },
    };
    const nowIso = effectiveNow.toISOString();
    const todayAttendance = await data.attendanceOn(tx, member.id, date);

    /* ------------------------------------------------------------ check in */
    if (payload.type === 'check_in') {
      const rostered = await data.rosteredShifts(tx, member.id, date);
      const decision = decideCheckIn(rostered, todayAttendance, ctx);
      if (!decision.ok) {
        const audit = decision.refusal.detail?.audit;
        if (typeof audit === 'string') {
          await data.writeAudit(tx, callerId, audit, { type: 'check_in' });
        }
        throw new AttendanceRefused(decision.refusal);
      }

      const { shift, status } = decision.value;
      const probePath = await storeProbe(
        tx, payload, settings.storeProbeImages, callerId, member.id, date, shift.id,
      );

      const written = await data.writeCheckIn(tx, {
        memberId: member.id,
        branchId: member.branchId,
        date,
        status,
        shiftId: shift.id,
        shiftName: shift.name,
        atIso: nowIso,
        lat: payload.lat,
        lng: payload.lng,
        accuracy: payload.accuracy,
        distance,
        faceScore: payload.faceScore,
        livenessPassed: payload.livenessPassed,
        isMock: payload.isMock,
        probePath,
        bypass: snapshot,
      });
      // Lost a race with another request for the same slot. The domain already
      // calls this `already_checked_in`; it simply could not see it from a read.
      if (!written) throw new AttendanceRefused(refuse(409, 'already_checked_in'));

      await data.writeAudit(tx, callerId, 'check_in', {
        date, status, distance, shift: shift.name,
      });
      return { ok: true as const, type: 'check_in' as const, status, distance, shift: shift.name };
    }

    /* ----------------------------------------------------------- check out */
    const yDate = previousDate(date);
    const toOpen = (records: typeof todayAttendance, d: string): OpenSlot[] =>
      records.filter((a) => a.checkInAt && !a.checkOutAt).map((record) => ({ record, date: d }));

    const decision = decideCheckOut(
      toOpen(todayAttendance, date),
      toOpen(await data.attendanceOn(tx, member.id, yDate), yDate),
      ctx,
      bypass,
    );
    if (!decision.ok) {
      const audit = decision.refusal.detail?.audit;
      if (typeof audit === 'string') {
        await data.writeAudit(tx, callerId, audit, { type: 'check_out' });
      }
      throw new AttendanceRefused(decision.refusal);
    }

    const out = decision.value;
    const probePath = await storeProbe(
      tx, payload, settings.storeProbeImages, callerId, member.id, date,
      out.record.shiftId ?? 'x',
    );

    await data.writeCheckOut(tx, {
      id: out.record.id,
      checkoutStatus: out.checkoutStatus,
      atIso: nowIso,
      lat: payload.lat,
      lng: payload.lng,
      accuracy: payload.accuracy,
      distance,
      faceScore: payload.faceScore,
      livenessPassed: payload.livenessPassed,
      isMock: payload.isMock,
      probePath,
      bypass: snapshot,
    });
    await data.writeAudit(tx, callerId, 'check_out', {
      date: out.date, status: out.record.status, distance,
    });

    return {
      ok: true as const,
      type: 'check_out' as const,
      status: out.record.status,
      distance,
      shift: out.shift?.name ?? null,
    };
  });
}
