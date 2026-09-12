// Access-token minting and verification.
//
// THE CLAIM SET
//
// `sub` / `aud` / `user_role` / `national_id`, and deliberately nothing more.
// This API is the only reader, so a claim exists here only if a guard or a
// handler in this codebase reads it — anything else is a fact about a user
// travelling in a signed blob that cannot be revoked until it expires.
//
// Changing `aud` invalidates access tokens minted before the change. That costs
// each signed-in client one 401, which its HTTP layer answers by presenting the
// refresh token (ClientApp/src/lib/api/http.ts) — refresh does not require a
// valid access token, so nobody is signed out.
//
// THE LIFETIME
//
// Short, and paired with a refresh token the database checks on every renewal.
// The pairing is what makes sign-out real: revoking the refresh row ends the
// session at the next renewal, whereas a long-lived access token that somebody
// copied off a phone is a working session until it expires, no matter what the
// server thinks.
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { Role } from '../enums/index.js';
/**
 * Who the token is for. Minted into `aud` and required on verification, so a
 * token issued by some other system that happens to share the secret is still
 * rejected.
 */
import { TOKEN_AUDIENCE } from '../../config/constants.js';
import { isRole } from '../../domain/identity/role.js';
/**
 * Mint an ACCESS token for a profile.
 *
 * `user_role` must always come from the stored profile, never from anything the
 * client sent: it is what the roles guard reads to decide what the bearer may
 * reach.
 */
export function signProfileJwt(profileId, nationalId, role) {
    return jwt.sign({
        sub: profileId,
        aud: TOKEN_AUDIENCE,
        user_role: role,
        national_id: nationalId,
    }, env.APP_JWT_SECRET, { algorithm: 'HS256', expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m` });
}
/** Mint a token for a member (the common case). */
export function signMemberJwt(profileId, nationalId) {
    return signProfileJwt(profileId, nationalId, Role.MEMBER);
}
/**
 * Verify a bearer token. Returns null on ANY failure (bad signature, expired,
 * wrong algorithm) — callers must treat null as unauthenticated, never as
 * "skip the check".
 */
export function verifyToken(token) {
    try {
        const payload = jwt.verify(token, env.APP_JWT_SECRET, {
            algorithms: ['HS256'], // pinned: prevents an `alg: none` / RS256 confusion attack
            audience: TOKEN_AUDIENCE,
        });
        if (typeof payload === 'string')
            return null;
        // READ, don't cast. jsonwebtoken hands back a JwtPayload with an
        // `[key: string]: any` index signature, so `as JwtClaims` asserts a shape
        // nobody checked: a token carrying `user_role: "wizard"` — or no role at
        // all — would arrive downstream typed as a Role and be believed. The
        // signature proves the token is ours; it proves nothing about its contents.
        const { sub, aud, user_role, national_id, iat, exp } = payload;
        if (typeof sub !== 'string' || !sub)
            return null;
        if (typeof aud !== 'string')
            return null;
        if (!isRole(user_role))
            return null;
        return {
            sub,
            aud,
            user_role,
            ...(typeof national_id === 'string' ? { national_id } : {}),
            ...(typeof iat === 'number' ? { iat } : {}),
            ...(typeof exp === 'number' ? { exp } : {}),
        };
    }
    catch {
        return null;
    }
}
/**
 * Pull the raw token out of an Authorization header.
 *
 * The scheme must be there. Stripping an optional `Bearer ` prefix instead
 * meant any header at all was handed on as a token — `Basic <base64>` included,
 * which is a credential being carried somewhere it was never meant to go.
 * Nothing relied on the laxness: every client sends the scheme.
 */
export function bearerToken(header) {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '');
    return match ? match[1] : null;
}
// Accounts are identified by NATIONAL ID, not by email. `profiles.email` is
// contact information a member may or may not have, never a credential and
// never a key — nothing signs in with it and nothing is sent to it.
//# sourceMappingURL=jwt.js.map