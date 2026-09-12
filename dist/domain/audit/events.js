// Which audit events describe a control being tested, and which are traffic.
//
// The trail records both, and it has to: "this member checked in at 07:58" is
// what makes "this member was refused at 07:57 for a mock location" mean
// something. But they are read for different reasons, and mixing them means the
// interesting row is one in a hundred.
//
// A pure list with a test, rather than a flag on the enum, because it IS a
// judgement about each event and belongs somewhere it can be read and argued
// with in one screen.
import { AuditEvent } from '../../common/enums/index.js';
/**
 * Events that record a refusal, an override, or a privileged act.
 *
 * `master_login` is here because it is the shared password that opens any
 * account: legitimate, and exactly the thing to be able to account for later.
 * `check_in` and `check_out` are not — they are the normal case, and a trail
 * where the normal case is highlighted highlights nothing.
 */
export const SECURITY_EVENTS = [
    AuditEvent.MOCK_LOCATION_DETECTED,
    AuditEvent.FACE_MISMATCH,
    AuditEvent.LIVENESS_FAILED,
    AuditEvent.INTEGRITY_FAILED,
    AuditEvent.MASTER_LOGIN,
    AuditEvent.STAFF_DELETED,
    AuditEvent.MEMBER_LOOKUP_OUT_OF_SCOPE,
    AuditEvent.OUT_OF_RANGE,
    AuditEvent.LOW_ACCURACY,
    AuditEvent.OUTSIDE_WINDOW,
    AuditEvent.CHECKOUT_BLOCKED,
];
export function isSecurityEvent(event) {
    return SECURITY_EVENTS.includes(event);
}
//# sourceMappingURL=events.js.map