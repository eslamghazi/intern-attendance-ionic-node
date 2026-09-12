export var AuditEvent;
(function (AuditEvent) {
    AuditEvent["LOGIN"] = "login";
    AuditEvent["PASSWORD_CHANGED"] = "password_changed";
    AuditEvent["FACE_ENROLLED"] = "face_enrolled";
    AuditEvent["MOCK_LOCATION_DETECTED"] = "mock_location_detected";
    AuditEvent["OUT_OF_RANGE"] = "out_of_range";
    AuditEvent["LOW_ACCURACY"] = "low_accuracy";
    AuditEvent["FACE_MISMATCH"] = "face_mismatch";
    AuditEvent["LIVENESS_FAILED"] = "liveness_failed";
    AuditEvent["INTEGRITY_FAILED"] = "integrity_failed";
    AuditEvent["CHECK_IN"] = "check_in";
    AuditEvent["CHECK_OUT"] = "check_out";
    AuditEvent["MASTER_LOGIN"] = "master_login";
    AuditEvent["STAFF_DELETED"] = "staff_deleted";
    /** A member looked up by identifier from OUTSIDE the caller's assignments.
     *  The lookup is allowed on purpose; recording it is what keeps it honest. */
    AuditEvent["MEMBER_LOOKUP_OUT_OF_SCOPE"] = "member_lookup_out_of_scope";
    AuditEvent["OUTSIDE_WINDOW"] = "outside_window";
    AuditEvent["CHECKOUT_BLOCKED"] = "checkout_blocked";
    /**
     * An unhandled server failure, recorded by the global exception filter.
     *
     * Only 5xx. A 4xx is the caller being told they got it wrong, which is the
     * system working; recording those would bury the trail under validation
     * noise. See ApiExceptionFilter.
     */
    AuditEvent["SERVER_ERROR"] = "server_error";
    /**
     * Every superadmin password hash left the system.
     *
     * A backup file is the one export that, on its own, is worth attacking
     * offline — so who took a copy and when is recorded. The restore beside it is
     * recorded for the opposite reason: it is the only way an account that can do
     * everything appears without anyone creating it.
     */
    AuditEvent["SUPERADMIN_BACKUP"] = "superadmin_backup";
    AuditEvent["SUPERADMIN_RESTORE"] = "superadmin_restore";
    /**
     * Attendance written from a file rather than at the door. One row per
     * import, with how many slots it wrote and refused — the trail for a month
     * that was typed in after the fact.
     */
    AuditEvent["ATTENDANCE_IMPORTED"] = "attendance_imported";
})(AuditEvent || (AuditEvent = {}));
//# sourceMappingURL=audit.enum.js.map