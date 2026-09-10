// Access-token minting and verification.
//
// The claim shape is deliberately unchanged — `sub` / `aud` / `role` /
// `user_role` / `national_id` — because it is not just a token payload: it is
// copied verbatim into `request.jwt.claims` for every query, and `auth.uid()`
// and `current_app_role()` read it. Renaming a claim here silently changes what
// forty-six policies can see.
//
// What DID change is the lifetime. This used to be the only token, valid for 30
// days, and nothing could revoke it: a copy lifted off a phone was a working
// session for a month, and signing out merely deleted the client's copy. It is
// now short-lived and paired with a refresh token the database checks on every
// renewal — see services/authService.ts and domain/auth/refresh.ts.
import jwt from 'jsonwebtoken';
import { env } from '../../env.js';
import { Role } from '../enums/index.js';
/**
 * Mint an ACCESS token for a profile. `user_role` is the claim RLS reads
 * through `current_app_role()`, so it is the single thing that decides what the
 * bearer can see — never derive it from client input.
 */
export function signProfileJwt(profileId, nationalId, role) {
    return jwt.sign({
        sub: profileId,
        aud: 'authenticated',
        role: 'authenticated',
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
            audience: 'authenticated',
        });
        if (typeof payload === 'string' || !payload.sub)
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
/** Pull the raw token out of an Authorization header. */
export function bearerToken(header) {
    if (!header)
        return null;
    const token = header.replace(/^Bearer\s+/i, '').trim();
    return token || null;
}
// nationalIdToEmail() lived here. Every staff account had a synthetic
// `n<national-id>@<domain>` address for one reason: GoTrue keyed users by email
// and would not accept an account without one. Nothing has ever signed in with
// it, no mail was ever sent to it, and with auth.users gone there is nowhere
// left to put it. The national ID is the identifier.
//# sourceMappingURL=jwt.js.map