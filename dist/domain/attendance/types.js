import { CheckType, AttendanceStatus, CheckoutStatus, CheckinMethod, } from '../../common/enums/index.js';
export { CheckType, AttendanceStatus, CheckoutStatus, CheckinMethod };
export const refuse = (status, reason, detail) => ({ status, reason, ...(detail ? { detail } : {}) });
export const decided = (value) => ({ ok: true, value });
export const rejected = (refusal) => ({ ok: false, refusal });
//# sourceMappingURL=types.js.map