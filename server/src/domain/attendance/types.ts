// The attendance domain, as plain data.
//
// Nothing here knows about HTTP, Postgres or Fastify. That is the point: the
// gate chain a student's check-in has to pass is the most safety-critical logic
// in the system, and while it lived inside a route handler welded to a
// transaction it could not be tested at all.
import {
  CheckType,
  AttendanceStatus,
  CheckoutStatus,
  CheckinMethod,
} from '../../common/enums/index.js';
import type { JsonObject, JsonValue } from '../../common/json.types.js';

export { CheckType, AttendanceStatus, CheckoutStatus, CheckinMethod };

/** Everything about the member the decision depends on, already resolved. */
export interface MemberContext {
  id: string;
  branchId: string;
  groupId: string | null;
  isActive: boolean;
  enrollmentStatus: string;
  /** Admin-pinned clock. When set, ALL time reasoning uses this instant. */
  frozenAt: string | null;
  /** End of a timed location bypass opened by an earlier QR scan. */
  locationBypassUntil: string | null;
  bypassFace: boolean;
  bypassLocation: boolean;
  bypassCheckoutWindow: boolean;
  branch: BranchFlags | null;
  group: EntityFlags | null;
}

export interface EntityFlags {
  bypassFace: boolean;
  bypassLocation: boolean;
  bypassCheckoutWindow: boolean;
}

export interface BranchFlags extends EntityFlags {
  blockCheckin: boolean;
  qrEnabled: boolean;
  requireQr: boolean;
}

/** The subset of app_settings the decision reads. */
export interface AttendanceSettings {
  checkinMethod: 'both' | 'location' | 'qr' | 'none';
  enforceShiftWindow: boolean;
  bypassCheckoutWindow: boolean;
  bypassFace: boolean;
  bypassLocation: boolean;
  livenessRequired: boolean;
  requirePlayIntegrity: boolean;
  faceMatchThreshold: number;
  maxAccuracyMeters: number;
  qrRequiresMember: boolean;
  storeProbeImages: boolean;
  /** Fallbacks for shifts that define no explicit window. */
  shiftStart: string | null;
  shiftEnd: string | null;
}

/** What the device claims. Every field of it is treated as untrusted. */
export interface CheckPayload {
  type: CheckType;
  lat: number;
  lng: number;
  accuracy: number;
  isMock: boolean;
  livenessPassed: boolean;
  /**
   * The similarity the CLIENT computed. Advisory only — the server recomputes
   * it from `probeEmbedding` and uses its own answer. Kept so the two can be
   * compared, and the disagreement recorded.
   */
  faceScore: number | null;
  /**
   * The 512-dimension embedding of the captured face, which the client already
   * had: it is the vector that produced `faceScore`. Sending it is what lets
   * the server verify rather than believe. Null from a client too old to send
   * it.
   */
  probeEmbedding: number[] | null;
  probePath: string | null;
  probeBase64: string | null;
  integrityToken: string | null;
  qrToken: string | null;
}

/** Where a location bypass came from, recorded on the attendance row. */
export type BypassSource = 'flag' | 'window' | 'qr' | null;

export interface BypassState {
  face: boolean;
  location: boolean;
  source: BypassSource;
  /** True when shift windows are not enforced app-wide. */
  shiftWindow: boolean;
  /** Check-out may happen at any time. */
  checkoutWindow: boolean;
  /** This branch accepts nothing at all right now. */
  blocked: boolean;
  /** Proximity is not accepted here — only a QR can clear the location gate. */
  requireQr: boolean;
  /** QR is an allowed method for this branch. */
  qrEnabled: boolean;
}

/**
 * A refusal the member sees. `reason` is the string the client switches on to
 * choose its message, so these values are part of the contract with the app.
 */
export interface Refusal {
  status: number;
  reason: string;
  detail?: JsonObject;
}

export const refuse = (
  status: number,
  reason: string,
  detail?: JsonObject,
): Refusal => ({ status, reason, ...(detail ? { detail } : {}) });

/** An attendance row as the decision needs to see it. */
export interface AttendanceRecord {
  id: string;
  shiftId: string | null;
  status: string;
  checkoutStatus: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  shift: ShiftRow | null;
}

export interface CheckInDecision {
  shift: ShiftRow;
  /** 'late' once the check-in-late boundary has passed. */
  status: AttendanceStatus.PRESENT | AttendanceStatus.LATE;
}

export interface CheckOutDecision {
  record: AttendanceRecord;
  /** The date the slot belongs to — yesterday for an overnight shift. */
  date: string;
  shift: ShiftRow | null;
  /** 'early_leave' when leaving before the check-out window opens. */
  checkoutStatus: CheckoutStatus.CHECKED_OUT | CheckoutStatus.EARLY_LEAVE;
}

/** Distinguish a decision from a refusal without exceptions. */
export type Decided<T> = { ok: true; value: T } | { ok: false; refusal: Refusal };

export const decided = <T>(value: T): Decided<T> => ({ ok: true, value });
export const rejected = <T>(refusal: Refusal): Decided<T> => ({ ok: false, refusal });

/**
 * A WGS84 coordinate, in degrees.
 *
 * A type alias rather than an interface, and that is load-bearing: TypeScript
 * gives an object-literal alias an implicit index signature and an interface
 * none, so only this form is assignable to JsonValue. A ring goes into a jsonb
 * column and comes back out of one, so it has to be JSON on both legs.
 */
export type LatLng = {
  lat: number;
  lng: number;
};

/** What the geofence gate in gates.ts consumes. */
export interface GeofenceResult {
  within: boolean;
  distanceM: number;
  radiusM: number;
}

/** The branch columns this needs. `area_coords` is the polygon, when set. */
export interface BranchGeofence {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  /** Straight off the jsonb column, so: JSON. readRing() is what makes it a ring. */
  areaCoords: JsonValue;
}

export interface ShiftRow {
  id: string;
  name: string;
  checkin_open: string | null;
  checkin_late: string | null;
  checkin_close: string | null;
  checkout_open: string | null;
  checkout_close: string | null;
  start_time: string | null;
  end_time: string | null;
}

export interface WindowDefaults {
  /** app_settings.shift_start — used when a shift has no explicit check-in-late. */
  shift_start: string | null;
  /** app_settings.shift_end — used when a shift has no explicit check-out-open. */
  shift_end: string | null;
}

export interface PlacedWindow {
  ciOpenP: number;
  ciLateP: number;
  ciCloseP: number;
  coOpenP: number;
  coCloseP: number;
  nowP: number;
}

export type AttendanceOutcome =
  /** No roster and no attendance — a day this member was not expected. */
  | 'off'
  /** Rostered, but the window has not closed yet. Not an absence. */
  | 'upcoming'
  /** Rostered, the window closed, nobody arrived. */
  | 'absent'
  | 'present_open'
  | 'present_out'
  | 'present_early'
  | 'present_left'
  | 'late_open'
  | 'late_out'
  | 'late_early'
  | 'late_left';

export interface SlotFacts {
  /** Is there a roster row for this slot? */
  hasRoster: boolean;
  /** Has the window to check in closed? See slotConcluded.ts. */
  concluded: boolean;
  checkInAt: string | null;
  /** `attendance.status` — how they arrived. */
  checkInStatus: string | null;
  checkOutAt: string | null;
  /** `attendance.checkout_status` — how they left, if they did. */
  checkoutStatus: string | null;
}

export interface SlotContext {
  settings: AttendanceSettings;
  /** Minutes since midnight, Cairo, of the effective (possibly frozen) clock. */
  minutesOfDay: number;
  defaults: WindowDefaults;
}

export interface OpenSlot {
  record: AttendanceRecord;
  date: string;
}

export interface SlotClock {
  /** Today in Cairo, `yyyy-MM-dd`. */
  date: string;
  /** Minutes since midnight, Cairo. */
  minutesOfDay: number;
}

export interface SlotDefaults {
  /** app_settings.shift_start — the fallback check-in-late boundary. */
  shiftStart: string | null;
  /** app_settings.shift_end — the fallback check-out-open boundary. */
  shiftEnd: string | null;
}

export interface BypassInput {
  settings: AttendanceSettings;
  member: MemberContext;
  /** The instant to judge the timed bypass window against. */
  now: Date;
  /** True when a QR token presented with THIS request was already validated. */
  qrAccepted?: boolean;
}

/**
 * A branch's polygon boundary, as stored in `branches.area_coords`.
 *
 * Nullable because most branches are a circle — a centre and a radius — and
 * only the awkwardly-shaped ones need a ring. Typed rather than left as
 * `unknown[]` so the validation in catalog.service and the reader in geofence.ts
 * agree about what they are passing each other.
 */
export type LatLngRing = LatLng[] | null;
