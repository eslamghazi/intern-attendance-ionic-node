export enum AttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
  EARLY_LEAVE = 'early_leave',
  ABSENT = 'absent',
  LEFT_WORK = 'left_work',
}

export enum CheckoutStatus {
  CHECKED_OUT = 'checked_out',
  EARLY_LEAVE = 'early_leave',
  LEFT_WORK = 'left_work',
}

export enum CheckType {
  CHECK_IN = 'check_in',
  CHECK_OUT = 'check_out',
}

export enum CheckinMethod {
  BOTH = 'both',
  LOCATION = 'location',
  QR = 'qr',
  NONE = 'none',
}

export enum EnrollmentStatus {
  PENDING = 'pending',
  ENROLLED = 'enrolled',
}
