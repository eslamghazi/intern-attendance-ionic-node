// The attendance domain, as plain data.
//
// Nothing here knows about HTTP, Postgres or Fastify. That is the point: the
// gate chain a student's check-in has to pass is the most safety-critical logic
// in the system, and while it lived inside a route handler welded to a
// transaction it could not be tested at all.
import { CheckType, AttendanceStatus, CheckoutStatus, CheckinMethod, } from '../../common/enums/index.js';
export { CheckType, AttendanceStatus, CheckoutStatus, CheckinMethod };
export const refuse = (status, reason, detail) => ({ status, reason, ...(detail ? { detail } : {}) });
export const decided = (value) => ({ ok: true, value });
export const rejected = (refusal) => ({ ok: false, refusal });
//# sourceMappingURL=types.js.map