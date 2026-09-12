import { describe, expect, it } from 'vitest';
import { checkSuperadminConfig } from './seedConfig.js';
const NID = '29001011234567';
const GOOD = 'a-real-password';
/** The reason, or '' when the verdict is not a refusal. */
const why = (nid, pw) => {
    const v = checkSuperadminConfig(nid, pw);
    return v.kind === 'refuse' ? v.why : '';
};
describe('checkSuperadminConfig', () => {
    it('seeds when both are set and usable', () => {
        expect(checkSuperadminConfig(NID, GOOD)).toEqual({ kind: 'seed' });
    });
    it('skips when neither is set — seeding nothing is a valid deployment', () => {
        expect(checkSuperadminConfig('', '')).toEqual({ kind: 'skip' });
    });
    describe('the placeholder from .env.example', () => {
        // THE REASON THIS FILE EXISTS. The API seeds at start-up now, so copying
        // .env.example and running the server must NOT create a superadmin whose
        // password is published in this repository.
        it('is refused', () => {
            expect(checkSuperadminConfig('00000000000000', 'CHANGE_ME_AT_LEAST_8_CHARS').kind).toBe('refuse');
        });
        it('is refused whatever its case or surroundings', () => {
            expect(checkSuperadminConfig(NID, 'change_me').kind).toBe('refuse');
            expect(checkSuperadminConfig(NID, 'xxCHANGE_MExx').kind).toBe('refuse');
        });
        it('is named as the reason, so the fix is obvious', () => {
            expect(why(NID, 'CHANGE_ME_AT_LEAST_8_CHARS')).toMatch(/placeholder/i);
        });
        it('is refused BEFORE the length rule, which would misdescribe it', () => {
            // The placeholder is 26 characters: long enough to pass a length check.
            // Reported as "too short" it would send somebody to lengthen a password
            // that is wrong for an entirely different reason.
            expect(why(NID, 'CHANGE_ME_AT_LEAST_8_CHARS')).not.toMatch(/at least/i);
        });
    });
    describe('half-configured', () => {
        it('refuses a password with no national id', () => {
            expect(why('', GOOD)).toMatch(/SUPERADMIN_NATIONAL_ID is empty/);
        });
        it('refuses a national id with no password', () => {
            expect(why(NID, '')).toMatch(/SUPERADMIN_PASSWORD is empty/);
        });
    });
    describe('malformed', () => {
        it('refuses a national id that is not 14 digits', () => {
            expect(why('123', GOOD)).toMatch(/14 digits/);
            expect(why('2900101123456789', GOOD)).toMatch(/14 digits/);
            expect(why('2900101123456x', GOOD)).toMatch(/14 digits/);
        });
        it('refuses 14 digits that are not a real national id', () => {
            // Right length, impossible date — parseNationalId is what knows.
            expect(why('29099911234567', GOOD)).toMatch(/not a valid national id/);
        });
        it('refuses a password under the floor', () => {
            expect(why(NID, 'short')).toMatch(/at least/);
        });
    });
});
//# sourceMappingURL=seedConfig.test.js.map