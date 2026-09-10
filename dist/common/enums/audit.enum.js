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
    AuditEvent["OUTSIDE_WINDOW"] = "outside_window";
    AuditEvent["CHECKOUT_BLOCKED"] = "checkout_blocked";
})(AuditEvent || (AuditEvent = {}));
//# sourceMappingURL=audit.enum.js.map