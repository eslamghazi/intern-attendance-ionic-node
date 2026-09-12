export var AttendanceStatus;
(function (AttendanceStatus) {
    AttendanceStatus["PRESENT"] = "present";
    AttendanceStatus["LATE"] = "late";
    AttendanceStatus["EARLY_LEAVE"] = "early_leave";
    AttendanceStatus["ABSENT"] = "absent";
    AttendanceStatus["LEFT_WORK"] = "left_work";
})(AttendanceStatus || (AttendanceStatus = {}));
export var CheckoutStatus;
(function (CheckoutStatus) {
    CheckoutStatus["CHECKED_OUT"] = "checked_out";
    CheckoutStatus["EARLY_LEAVE"] = "early_leave";
    CheckoutStatus["LEFT_WORK"] = "left_work";
})(CheckoutStatus || (CheckoutStatus = {}));
export var CheckType;
(function (CheckType) {
    CheckType["CHECK_IN"] = "check_in";
    CheckType["CHECK_OUT"] = "check_out";
})(CheckType || (CheckType = {}));
export var CheckinMethod;
(function (CheckinMethod) {
    CheckinMethod["BOTH"] = "both";
    CheckinMethod["LOCATION"] = "location";
    CheckinMethod["QR"] = "qr";
    CheckinMethod["NONE"] = "none";
})(CheckinMethod || (CheckinMethod = {}));
export var EnrollmentStatus;
(function (EnrollmentStatus) {
    EnrollmentStatus["PENDING"] = "pending";
    EnrollmentStatus["ENROLLED"] = "enrolled";
})(EnrollmentStatus || (EnrollmentStatus = {}));
//# sourceMappingURL=attendance.enum.js.map