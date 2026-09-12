// What a presented refresh token means.
//
// Sign-in used to hand out one JWT that lasted 30 days. Nothing could revoke
// it: a token copied off a phone stayed a valid session for a month, and
// "sign out" only deleted the client's copy. Changing a password did not end
// it either.
//
// The replacement is a short access token plus a refresh token that is checked
// against the database every time it is used. That check is the whole point,
// so the rule for it is written here, on its own, with no database in sight.
//
// THE CASE THAT MATTERS
//
// Rotation alone buys very little: if a stolen token is exchanged once, the
// thief simply holds the new one. What makes it worth doing is noticing the
// SECOND use of an already-rotated token — because the legitimate holder and
// the thief now both have descendants of the same token, and whichever presents
// an old one proves that a copy exists. There is no innocent explanation a
// client can produce for that, so the entire family is revoked and both parties
// are made to sign in again.
//
// It does mean a genuine race — two tabs refreshing at the same instant — logs
// the user out. That is why the client refreshes in a single flight; see
// ClientApp/src/lib/api/http.ts.
export function classifyRefresh(stored, now) {
    if (!stored)
        return { kind: 'reject', reason: 'unknown' };
    // Reuse is checked BEFORE expiry and before revocation. A replayed token that
    // has since expired is still evidence of a copy, and the family it belongs to
    // may hold descendants that are very much alive.
    if (stored.rotatedAt !== null)
        return { kind: 'reuse', familyId: stored.familyId };
    if (stored.revokedAt !== null)
        return { kind: 'reject', reason: 'revoked' };
    if (stored.expiresAt.getTime() <= now.getTime())
        return { kind: 'reject', reason: 'expired' };
    return { kind: 'rotate' };
}
/** When a token issued now should stop working. */
export function expiryFrom(now, ttlDays) {
    return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
}
/**
 * Seconds of life left in an access token, for the client's `expires_in`.
 *
 * Rounded DOWN and floored at zero: telling a client it has more time than it
 * does produces a request that fails at the worst possible moment, and a
 * negative number would be read as "already expired" by anything doing
 * arithmetic on it.
 */
export function expiresInSeconds(ttlMinutes) {
    return Math.max(0, Math.floor(ttlMinutes * 60));
}
//# sourceMappingURL=refresh.js.map