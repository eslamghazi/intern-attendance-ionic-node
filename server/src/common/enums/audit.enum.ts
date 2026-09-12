export enum AuditEvent {
  LOGIN = 'login',
  PASSWORD_CHANGED = 'password_changed',
  FACE_ENROLLED = 'face_enrolled',
  MOCK_LOCATION_DETECTED = 'mock_location_detected',
  OUT_OF_RANGE = 'out_of_range',
  LOW_ACCURACY = 'low_accuracy',
  FACE_MISMATCH = 'face_mismatch',
  LIVENESS_FAILED = 'liveness_failed',
  INTEGRITY_FAILED = 'integrity_failed',
  CHECK_IN = 'check_in',
  CHECK_OUT = 'check_out',
  MASTER_LOGIN = 'master_login',
  STAFF_DELETED = 'staff_deleted',
  /** A member looked up by identifier from OUTSIDE the caller's assignments.
   *  The lookup is allowed on purpose; recording it is what keeps it honest. */
  MEMBER_LOOKUP_OUT_OF_SCOPE = 'member_lookup_out_of_scope',
  OUTSIDE_WINDOW = 'outside_window',
  CHECKOUT_BLOCKED = 'checkout_blocked',
  /**
   * An unhandled server failure, recorded by the global exception filter.
   *
   * Only 5xx. A 4xx is the caller being told they got it wrong, which is the
   * system working; recording those would bury the trail under validation
   * noise. See ApiExceptionFilter.
   */
  SERVER_ERROR = 'server_error',
}
