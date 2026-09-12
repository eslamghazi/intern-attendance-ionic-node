// Minting and verifying an access token.
//
// verifyToken used to end in `payload as unknown as JwtClaims` — the signature
// was checked and the contents were not, so a token carrying no `user_role`, or
// one reading `"wizard"`, arrived downstream typed as a Role. It now reads the
// claims instead of asserting them, and these tests are what say the reading
// still accepts the tokens this service itself mints: get that wrong and nobody
// can sign in at all.
import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { TOKEN_AUDIENCE } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { Role } from '../enums/index.js';
import { bearerToken, signMemberJwt, signProfileJwt, verifyToken } from './jwt.js';
const PROFILE = '11111111-1111-4111-8111-111111111111';
const NATIONAL_ID = '29801011234567';
/** A token signed with the real secret but with claims of our choosing. */
function forge(claims) {
    return jwt.sign(claims, env.APP_JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
}
describe('sign then verify', () => {
    it('round-trips every role this service can mint', () => {
        for (const role of [Role.MEMBER, Role.ADMIN, Role.SUPERADMIN]) {
            const claims = verifyToken(signProfileJwt(PROFILE, NATIONAL_ID, role));
            expect(claims).not.toBeNull();
            expect(claims.sub).toBe(PROFILE);
            expect(claims.aud).toBe(TOKEN_AUDIENCE);
            expect(claims.user_role).toBe(role);
            expect(claims.national_id).toBe(NATIONAL_ID);
        }
    });
    it('mints a member token by default', () => {
        expect(verifyToken(signMemberJwt(PROFILE, NATIONAL_ID)).user_role).toBe(Role.MEMBER);
    });
    it('carries the lifetime claims through', () => {
        const claims = verifyToken(signMemberJwt(PROFILE, NATIONAL_ID));
        expect(typeof claims.iat).toBe('number');
        expect(typeof claims.exp).toBe('number');
        expect(claims.exp).toBeGreaterThan(claims.iat);
    });
});
describe('what verifyToken refuses', () => {
    it('refuses a correctly signed token with no role', () => {
        expect(verifyToken(forge({ sub: PROFILE, aud: TOKEN_AUDIENCE }))).toBeNull();
    });
    it('refuses a role that is not one of ours', () => {
        expect(verifyToken(forge({ sub: PROFILE, aud: TOKEN_AUDIENCE, user_role: 'wizard' }))).toBeNull();
    });
    it('refuses a token with no subject', () => {
        expect(verifyToken(forge({ aud: TOKEN_AUDIENCE, user_role: Role.MEMBER }))).toBeNull();
        expect(verifyToken(forge({ sub: '', aud: TOKEN_AUDIENCE, user_role: Role.MEMBER }))).toBeNull();
    });
    it('refuses another audience, so a token minted elsewhere does not open this API', () => {
        expect(verifyToken(forge({ sub: PROFILE, aud: 'someone-else', user_role: Role.MEMBER }))).toBeNull();
    });
    it('refuses a foreign signature', () => {
        const foreign = jwt.sign({ sub: PROFILE, aud: TOKEN_AUDIENCE, user_role: Role.SUPERADMIN }, 'not-the-secret-not-the-secret-32b', { algorithm: 'HS256', expiresIn: '5m' });
        expect(verifyToken(foreign)).toBeNull();
    });
    it('refuses an expired token', () => {
        const stale = jwt.sign({ sub: PROFILE, aud: TOKEN_AUDIENCE, user_role: Role.MEMBER }, env.APP_JWT_SECRET, { algorithm: 'HS256', expiresIn: '-1s' });
        expect(verifyToken(stale)).toBeNull();
    });
    it('refuses an unsigned token — the alg:none attack', () => {
        const none = jwt.sign({ sub: PROFILE, aud: TOKEN_AUDIENCE, user_role: Role.SUPERADMIN }, '', { algorithm: 'none' });
        expect(verifyToken(none)).toBeNull();
    });
    it('refuses garbage without throwing', () => {
        expect(verifyToken('')).toBeNull();
        expect(verifyToken('not.a.token')).toBeNull();
    });
    it('drops a national_id that is not a string rather than passing it on', () => {
        const claims = verifyToken(forge({ sub: PROFILE, aud: TOKEN_AUDIENCE, user_role: Role.MEMBER, national_id: 12345 }));
        expect(claims).not.toBeNull();
        expect(claims.national_id).toBeUndefined();
    });
});
describe('bearerToken', () => {
    it('takes the token out of an Authorization header', () => {
        expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    });
    it('is null for anything that is not a bearer header', () => {
        expect(bearerToken(undefined)).toBeNull();
        expect(bearerToken('')).toBeNull();
        expect(bearerToken('Basic abc')).toBeNull();
    });
});
//# sourceMappingURL=jwt.test.js.map