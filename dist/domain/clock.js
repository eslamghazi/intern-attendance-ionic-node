// The operational clock.
//
// Everything in this system is reasoned about in Africa/Cairo, and Egypt has
// observed daylight saving again since 2023 — so "UTC+2" is wrong for roughly
// half the academic year. The offset is never assumed; it is always derived
// from the zone.
//
// The process timezone is UTC (see docker-compose.yml) and must stay that way:
// nothing here reads the host's local zone.
import { formatInTimeZone } from 'date-fns-tz';
export const CAIRO = 'Africa/Cairo';
/**
 * Date and minutes-of-day in Cairo. Pass an explicit instant to reason about a
 * fixed time — an admin-frozen clock, or a test.
 */
export function cairoNow(at = new Date()) {
    const date = formatInTimeZone(at, CAIRO, 'yyyy-MM-dd');
    const hour = Number(formatInTimeZone(at, CAIRO, 'HH'));
    const minute = Number(formatInTimeZone(at, CAIRO, 'mm'));
    return { date, minutesOfDay: hour * 60 + minute };
}
/** 'yyyy-MM-dd' for an instant, in Cairo. */
export function cairoDate(at = new Date()) {
    return formatInTimeZone(at, CAIRO, 'yyyy-MM-dd');
}
/** 'HH:mm:ss' for an instant, in Cairo. */
export function cairoTime(at = new Date()) {
    return formatInTimeZone(at, CAIRO, 'HH:mm:ss');
}
//# sourceMappingURL=clock.js.map