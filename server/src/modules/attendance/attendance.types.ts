// What a check-in and a check-out record.
//
// One shape per direction rather than one with half its fields optional:
// the two events carry different evidence, and a single type would make
// every field nullable and leave every reader guessing which half applies.


import type { AttendanceStatus, CheckType, CheckoutStatus } from '../../common/enums/index.js';
import type { JsonObject } from '../../common/json.types.js';

export interface CheckInWrite {
  memberId: string;
  branchId: string;
  date: string;
  status: AttendanceStatus.PRESENT | AttendanceStatus.LATE;
  shiftId: string;
  shiftName: string;
  atIso: string;
  lat: number;
  lng: number;
  accuracy: number;
  distance: number;
  faceScore: number | null;
  livenessPassed: boolean;
  isMock: boolean;
  probePath: string | null;
  bypass: JsonObject | null;
}

export interface CheckOutWrite {
  id: string;
  checkoutStatus: CheckoutStatus.CHECKED_OUT | CheckoutStatus.EARLY_LEAVE;
  atIso: string;
  lat: number;
  lng: number;
  accuracy: number;
  distance: number;
  faceScore: number | null;
  livenessPassed: boolean;
  isMock: boolean;
  probePath: string | null;
  bypass: JsonObject | null;
}

export interface SetAttendanceInput {
  memberId: string;
  date: string;
  status: AttendanceStatus | null;
  clear: boolean;
  shiftId: string | null;
}

export interface CheckResult {
  ok: true;
  type: CheckType;
  status: string;
  distance: number;
  shift: string | null;
}
