// The gates a check-in or check-out must pass, as pure decisions.
//
// Ordering is deliberate: the cheapest and most absolute refusals come first,
// and a bypass short-circuits the gate it covers rather than being tested inside
// it. Keeping that order visible in ONE file is most of the value here —
// "does a location bypass also skip the accuracy check?" should be answerable by
// reading, not by tracing a request through a long handler. (It does. That is
// why they are one block.)
import {
  refuse,
  type AttendanceSettings,
  type BypassState,
  type CheckPayload,
  type MemberContext,
  type Refusal,
} from './types.js';
import {
  CheckinMethod,
  AuditEvent,
  EnrollmentStatus,
  AttendanceRefusalReason,
} from '../../common/enums/index.js';
import type { BypassInput } from './types.js';
import type { JsonObject, JsonValue } from '../../common/json.types.js';
export type { BypassInput } from './types.js';

/** Any TRUE across global, member, branch and group turns a bypass on. */
function anyOn(
  global: boolean,
  member: boolean,
  branch: boolean | undefined,
  group: boolean | undefined,
): boolean {
  return Boolean(global || member || branch || group);
}

/**
 * Resolve which gates are switched off for this member right now.
 *
 * The effective check-in METHOD is the most restrictive of global and branch,
 * while every bypass is the most permissive of the four levels. Those pull in
 * opposite directions on purpose: a bypass is a concession granted to someone,
 * a method restriction is a rule imposed on a place.
 */
export function resolveBypass({ settings, member, now, qrAccepted }: BypassInput): BypassState {
  const branch = member.branch;
  const group = member.group;

  const method = settings.checkinMethod || CheckinMethod.BOTH;
  const blocked = method === CheckinMethod.NONE || Boolean(branch?.blockCheckin);
  const requireQr = method === CheckinMethod.QR || Boolean(branch?.requireQr);
  const qrEnabled = (method === CheckinMethod.QR || method === CheckinMethod.BOTH) && branch?.qrEnabled !== false;

  const face = anyOn(
    settings.bypassFace,
    member.bypassFace,
    branch?.bypassFace,
    group?.bypassFace,
  );

  let location = anyOn(
    settings.bypassLocation,
    member.bypassLocation,
    branch?.bypassLocation,
    group?.bypassLocation,
  );
  let source: BypassState['source'] = location ? 'flag' : null;

  // A QR scanned earlier opened a timed window.
  if (!location && member.locationBypassUntil && new Date(member.locationBypassUntil) > now) {
    location = true;
    source = 'window';
  }
  // A token presented with this very request.
  if (!location && qrAccepted) {
    location = true;
    source = 'qr';
  }

  return {
    face,
    location,
    source,
    shiftWindow: !settings.enforceShiftWindow,
    checkoutWindow: anyOn(
      settings.bypassCheckoutWindow,
      member.bypassCheckoutWindow,
      branch?.bypassCheckoutWindow,
      group?.bypassCheckoutWindow,
    ),
    blocked,
    requireQr,
    qrEnabled,
  };
}

/** What the attendance row records about which gates were skipped. */
export function bypassSnapshot(b: BypassState): JsonObject | null {
  if (!b.face && !b.location && !b.shiftWindow) return null;
  return { face: b.face, location: b.location, source: b.source, shift_window: b.shiftWindow };
}

/**
 * Placeholder for Play Integrity / App Attest.
 *
 * Carried over unchanged from the original recorder: when integrity is required a
 * token must be PRESENT, but it is not verified against Google or Apple. That
 * is an open hole, and naming it here rather than burying it in a handler is
 * the point — a present-but-forged token passes.
 */
export function integrityOk(token: string | null, required: boolean): boolean {
  return required ? Boolean(token) : true;
}

// The geofence answer itself is computed in ./geofence.ts. Re-exported here
// because this is where every caller already imports the gate types from.
export type { GeofenceResult } from './geofence.js';
import type { GeofenceResult } from './geofence.js';

/**
 * Gates that do not depend on the roster: integrity, then location, then face.
 * Returns the refusal, or null when everything passed.
 *
 * `geofence` is passed in rather than computed here, because it needs the
 * branch row. It may be null when the location bypass is on — in which case it
 * is never read — or when the branch could not be found, which is a
 * misconfiguration and answered with a 500 rather than a refusal.
 */
export function checkGates(
  payload: CheckPayload,
  settings: AttendanceSettings,
  bypass: BypassState,
  member: MemberContext,
  geofence: GeofenceResult | null,
): { refusal: Refusal | null; distance: number; audit: { event: string; detail: JsonValue } | null } {
  const fail = (
    refusal: Refusal,
    event?: string,
    detail: JsonValue = null,
  ): ReturnType<typeof checkGates> => ({
    refusal,
    distance: 0,
    audit: event ? { event, detail } : null,
  });

  if (bypass.blocked) return fail(refuse(403, AttendanceRefusalReason.BRANCH_BLOCKED));

  // Proximity is not accepted at this branch and nothing has cleared location.
  if (bypass.requireQr && !bypass.location) {
    return fail(refuse(422, AttendanceRefusalReason.QR_REQUIRED), AuditEvent.OUT_OF_RANGE, { require_qr: true });
  }

  // Enrolment only matters when the face gate is actually enforced.
  if (!bypass.face && member.enrollmentStatus !== EnrollmentStatus.ENROLLED) {
    return fail(refuse(422, AttendanceRefusalReason.NOT_ENROLLED));
  }

  if (!integrityOk(payload.integrityToken, settings.requirePlayIntegrity)) {
    return fail(refuse(422, AttendanceRefusalReason.INTEGRITY_FAILED), AuditEvent.INTEGRITY_FAILED, { type: payload.type });
  }

  let distance = 0;
  if (!bypass.location) {
    if (payload.isMock === true) {
      return fail(refuse(422, AttendanceRefusalReason.MOCK), AuditEvent.MOCK_LOCATION_DETECTED, {
        lat: payload.lat,
        lng: payload.lng,
      });
    }
    if (typeof payload.accuracy === 'number' && payload.accuracy > settings.maxAccuracyMeters) {
      return fail(refuse(422, AttendanceRefusalReason.LOW_ACCURACY, { accuracy: payload.accuracy }), AuditEvent.LOW_ACCURACY, {
        accuracy: payload.accuracy,
      });
    }
    if (!geofence) return fail(refuse(500, AttendanceRefusalReason.GEOFENCE_ERROR));
    distance = Math.round(geofence.distanceM);
    if (!geofence.within) {
      return {
        refusal: refuse(422, AttendanceRefusalReason.OUT_OF_RANGE, { distance, radius: geofence.radiusM }),
        distance,
        audit: { event: AuditEvent.OUT_OF_RANGE, detail: { distance, radius: geofence.radiusM } },
      };
    }
  }

  if (!bypass.face) {
    if (settings.livenessRequired && !payload.livenessPassed) {
      return { refusal: refuse(422, AttendanceRefusalReason.LIVENESS), distance, audit: { event: AuditEvent.LIVENESS_FAILED, detail: { type: payload.type } } };
    }
    if (typeof payload.faceScore !== 'number') {
      return { refusal: refuse(422, AttendanceRefusalReason.FACE_REQUIRED), distance, audit: null };
    }
    if (payload.faceScore < settings.faceMatchThreshold) {
      return {
        refusal: refuse(422, AttendanceRefusalReason.FACE_MISMATCH, { score: payload.faceScore }),
        distance,
        audit: { event: AuditEvent.FACE_MISMATCH, detail: { score: payload.faceScore } },
      };
    }
  }

  return { refusal: null, distance, audit: null };
}
