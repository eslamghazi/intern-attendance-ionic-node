import { describe, expect, it } from 'vitest';
import { bypassMinutes, checkinBlocked, mintToken, planMint, qrAllowed, validitySeconds, } from './token.js';
const settings = (over = {}) => ({
    checkinMethod: 'both',
    qrRequiresMember: false,
    qrValiditySeconds: 25,
    qrBypassMinutes: 30,
    ...over,
});
describe('qrAllowed', () => {
    it('allows QR under both and qr, never under location or none', () => {
        expect(qrAllowed('both', true)).toBe(true);
        expect(qrAllowed('qr', true)).toBe(true);
        expect(qrAllowed('location', true)).toBe(false);
        expect(qrAllowed('none', true)).toBe(false);
    });
    it('lets a branch switch it off even when the app allows it', () => {
        expect(qrAllowed('both', false)).toBe(false);
    });
    it('treats a branch that never set the flag as enabled', () => {
        expect(qrAllowed('both', null)).toBe(true);
    });
});
describe('checkinBlocked', () => {
    it('is blocked by the global method or by the branch', () => {
        expect(checkinBlocked('none', false)).toBe(true);
        expect(checkinBlocked('both', true)).toBe(true);
        expect(checkinBlocked('both', false)).toBe(false);
        expect(checkinBlocked('both', null)).toBe(false);
    });
});
describe('validitySeconds', () => {
    it('uses the configured value', () => {
        expect(validitySeconds(settings({ qrValiditySeconds: 40 }))).toBe(40);
    });
    it('defaults to 25 when unset or zero', () => {
        expect(validitySeconds(settings({ qrValiditySeconds: null }))).toBe(25);
        expect(validitySeconds(settings({ qrValiditySeconds: 0 }))).toBe(25);
    });
    it('never goes below five seconds', () => {
        // Below that a slow camera can never succeed at all.
        expect(validitySeconds(settings({ qrValiditySeconds: 1 }))).toBe(5);
    });
});
describe('bypassMinutes', () => {
    it('defaults to 30 and never goes below one', () => {
        expect(bypassMinutes(settings({ qrBypassMinutes: null }))).toBe(30);
        expect(bypassMinutes(settings({ qrBypassMinutes: 0 }))).toBe(30);
        expect(bypassMinutes(settings({ qrBypassMinutes: -5 }))).toBe(1);
    });
});
describe('mintToken', () => {
    it('is 64 hex characters', () => {
        expect(mintToken()).toMatch(/^[0-9a-f]{64}$/);
    });
    it('does not repeat', () => {
        const seen = new Set(Array.from({ length: 200 }, mintToken));
        expect(seen.size).toBe(200);
    });
});
describe('planMint', () => {
    it('refuses without a branch', () => {
        expect(planMint({ byMember: false, branchId: null, memberId: null }, settings())).toEqual({
            ok: false,
            reason: 'missing',
        });
    });
    it('makes a staff token targeting one member single-use', () => {
        const r = planMint({ byMember: false, branchId: 'b1', memberId: 'm1' }, settings());
        expect(r).toEqual({ ok: true, plan: { branchId: 'b1', memberId: 'm1', singleUse: true } });
    });
    it('makes a branch-wide token reusable while it lives', () => {
        // A supervisor shows one screen to a queue of people.
        const r = planMint({ byMember: false, branchId: 'b1', memberId: null }, settings());
        expect(r).toEqual({ ok: true, plan: { branchId: 'b1', memberId: null, singleUse: false } });
    });
    it('strips a member target from a MEMBER generator', () => {
        // Letting a member target an individual would let them check in a
        // colleague who is not there.
        const r = planMint({ byMember: true, branchId: 'b1', memberId: 'victim' }, settings());
        expect(r).toEqual({ ok: true, plan: { branchId: 'b1', memberId: null, singleUse: false } });
    });
    it('enforces "must target a member" for staff', () => {
        const strict = settings({ qrRequiresMember: true });
        expect(planMint({ byMember: false, branchId: 'b1', memberId: null }, strict)).toEqual({
            ok: false,
            reason: 'member_required',
        });
        expect(planMint({ byMember: false, branchId: 'b1', memberId: 'm1' }, strict).ok).toBe(true);
    });
    it('does NOT apply that rule to a member generator, who cannot comply', () => {
        const strict = settings({ qrRequiresMember: true });
        expect(planMint({ byMember: true, branchId: 'b1', memberId: null }, strict).ok).toBe(true);
    });
});
//# sourceMappingURL=token.test.js.map