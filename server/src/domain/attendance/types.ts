// The attendance domain, as plain data.
//
// Nothing here knows about HTTP, Postgres or Fastify. That is the point: the
// gate chain a student's check-in has to pass is the most safety-critical logic
// in the system, and while it lived inside a route handler welded to a
// transaction it could not be tested at all.
import type { ShiftRow } from './windows.js';
import {
  CheckType,
  AttendanceStatus,
  CheckoutStatus,
  CheckinMethod,
} from '../../common/enums/index.js';

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
  faceScore: number | null;
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
  detail?: Record<string, unknown>;
}

export const refuse = (
  status: number,
  reason: string,
  detail?: Record<string, unknown>,
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
