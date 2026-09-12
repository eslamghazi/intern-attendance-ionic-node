// Is this environment allowed to create the first superadmin?
//
// A pure rule, kept apart from the service that acts on it, because the thing
// it prevents is worth a test that needs no database: `.env.example` ships
// `SUPERADMIN_PASSWORD=CHANGE_ME_AT_LEAST_8_CHARS`, and the API now seeds at
// start-up — so copying that file and running the server would otherwise mint a
// superadmin whose password is published in this repository.
//
// When seeding was a script you ran deliberately, that was your own mistake to
// make. Automatic, it would be ours.
import { SUPERADMIN_PASSWORD_MIN } from '../../config/constants.js';
import { parseNationalId } from './nationalId.js';
/**
 * What the environment says to do about the first superadmin.
 *
 *   'skip'    neither variable is set — a deployment that seeds nothing
 *   'seed'    both are set and usable
 *   'refuse'  half-configured, malformed, or still the placeholder
 *
 * `refuse` carries the reason, because "I set the environment variables and the
 * account does not work" is the failure this is here to end.
 */
export function checkSuperadminConfig(nationalId, password) {
    const refuse = (why) => ({ kind: 'refuse', why });
    if (!nationalId && !password)
        return { kind: 'skip' };
    if (!nationalId)
        return refuse('SUPERADMIN_PASSWORD is set but SUPERADMIN_NATIONAL_ID is empty');
    if (!password)
        return refuse('SUPERADMIN_NATIONAL_ID is set but SUPERADMIN_PASSWORD is empty');
    // Before any other check: a placeholder is not a weak password, it is a
    // published one, and saying so names the fix.
    if (/CHANGE_ME/i.test(password)) {
        return refuse('SUPERADMIN_PASSWORD is still the placeholder from .env.example. ' +
            'Set a real one, or clear SUPERADMIN_NATIONAL_ID to seed nothing.');
    }
    if (!/^\d{14}$/.test(nationalId)) {
        return refuse(`SUPERADMIN_NATIONAL_ID must be 14 digits (got ${nationalId.length} characters)`);
    }
    if (!parseNationalId(nationalId).valid) {
        return refuse(`SUPERADMIN_NATIONAL_ID ${nationalId} is not a valid national id`);
    }
    if (password.length < SUPERADMIN_PASSWORD_MIN) {
        return refuse(`SUPERADMIN_PASSWORD must be at least ${SUPERADMIN_PASSWORD_MIN} characters`);
    }
    return { kind: 'seed' };
}
//# sourceMappingURL=seedConfig.js.map