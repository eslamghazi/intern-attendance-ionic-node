// The check-in gate chain. None of this was testable while it lived inside the
// route handler, which is the whole reason the domain layer exists.
import { describe, expect, it } from 'vitest';
import { bypassSnapshot, checkGates, resolveBypass } from './gates.js';
import { CheckType } from '../../common/enums/index.js';
const SETTINGS = {
    checkinMethod: 'both',
    enforceShiftWindow: true,
    bypassCheckoutWindow: false,
    bypassFace: false,
    bypassLocation: false,
    livenessRequired: true,
    requirePlayIntegrity: false,
    faceMatchThreshold: 0.45,
    maxAccuracyMeters: 50,
    qrRequiresMember: false,
    storeProbeImages: true,
    shiftStart: '07:00',
    shiftEnd: '17:00',
};
const MEMBER = {
    id: 'm1',
    branchId: 'b1',
    groupId: 'g1',
    isActive: true,
    enrollmentStatus: 'enrolled',
    frozenAt: null,
    locationBypassUntil: null,
    bypassFace: false,
    bypassLocation: false,
    bypassCheckoutWindow: false,
    branch: {
        bypassFace: false,
        bypassLocation: false,
        bypassCheckoutWindow: false,
        blockCheckin: false,
        qrEnabled: true,
        requireQr: false,
    },
    group: { bypassFace: false, bypassLocation: false, bypassCheckoutWindow: false },
};
const PAYLOAD = {
    type: CheckType.CHECK_IN,
    lat: 31.1,
    lng: 30.9,
    accuracy: 12,
    isMock: false,
    livenessPassed: true,
    faceScore: 0.8,
    probeEmbedding: null,
    probePath: null,
    probeBase64: null,
    integrityToken: null,
    qrToken: null,
};
const INSIDE = { within: true, distanceM: 12.4, radiusM: 150 };
const OUTSIDE = { within: false, distanceM: 812.6, radiusM: 150 };
const NOW = new Date('2026-08-29T09:00:00Z');
const bypassOf = (member = MEMBER, settings = SETTINGS, qrAccepted = false) => resolveBypass({ settings, member, now: NOW, qrAccepted });
const gate = (payload = {}, member = MEMBER, settings = SETTINGS, geo = INSIDE) => checkGates({ ...PAYLOAD, ...payload }, settings, bypassOf(member, settings), member, geo);
describe('resolveBypass', () => {
    it('is all-off for a plain member at a plain branch', () => {
        const b = bypassOf();
        expect(b.face).toBe(false);
        expect(b.location).toBe(false);
        expect(b.blocked).toBe(false);
        expect(b.source).toBeNull();
    });
    it('turns a bypass on from ANY of the four levels', () => {
        expect(bypassOf({ ...MEMBER, bypassFace: true }).face).toBe(true);
        expect(bypassOf(MEMBER, { ...SETTINGS, bypassFace: true }).face).toBe(true);
        expect(bypassOf({ ...MEMBER, branch: { ...MEMBER.branch, bypassFace: true } }).face).toBe(true);
        expect(bypassOf({ ...MEMBER, group: { ...MEMBER.group, bypassFace: true } }).face).toBe(true);
    });
    it('records where a location bypass came from', () => {
        expect(bypassOf({ ...MEMBER, bypassLocation: true }).source).toBe('flag');
        // A QR window that is still open.
        expect(bypassOf({ ...MEMBER, locationBypassUntil: '2026-08-29T09:30:00Z' }).source).toBe('window');
        expect(bypassOf(MEMBER, SETTINGS, true).source).toBe('qr');
    });
    it('ignores a QR window that has already expired', () => {
        const b = bypassOf({ ...MEMBER, locationBypassUntil: '2026-08-29T08:59:00Z' });
        expect(b.location).toBe(false);
        expect(b.source).toBeNull();
    });
    it('takes the MOST RESTRICTIVE method across global and branch', () => {
        expect(bypassOf(MEMBER, { ...SETTINGS, checkinMethod: 'none' }).blocked).toBe(true);
        expect(bypassOf({ ...MEMBER, branch: { ...MEMBER.branch, blockCheckin: true } }).blocked).toBe(true);
        expect(bypassOf(MEMBER, { ...SETTINGS, checkinMethod: 'qr' }).requireQr).toBe(true);
        expect(bypassOf({ ...MEMBER, branch: { ...MEMBER.branch, requireQr: true } }).requireQr).toBe(true);
        expect(bypassOf({ ...MEMBER, branch: { ...MEMBER.branch, qrEnabled: false } }).qrEnabled).toBe(false);
    });
});
describe('checkGates — refusals', () => {
    it('passes a clean check-in and reports the rounded distance', () => {
        const r = gate();
        expect(r.refusal).toBeNull();
        expect(r.distance).toBe(12);
    });
    it('blocks the whole branch before anything else is considered', () => {
        const member = { ...MEMBER, branch: { ...MEMBER.branch, blockCheckin: true } };
        // Even with a perfect payload.
        expect(gate({}, member).refusal?.reason).toBe('branch_blocked');
    });
    it('refuses a mock GPS fix and audits it', () => {
        const r = gate({ isMock: true });
        expect(r.refusal?.reason).toBe('mock');
        expect(r.audit?.event).toBe('mock_location_detected');
    });
    it('refuses a fix less accurate than the setting allows', () => {
        expect(gate({ accuracy: 51 }).refusal?.reason).toBe('low_accuracy');
        expect(gate({ accuracy: 50 }).refusal).toBeNull();
    });
    it('refuses a fix outside the geofence, with the distance', () => {
        const r = gate({}, MEMBER, SETTINGS, OUTSIDE);
        expect(r.refusal?.reason).toBe('out_of_range');
        expect(r.refusal?.detail).toEqual({ distance: 813, radius: 150 });
        expect(r.distance).toBe(813);
    });
    it('refuses a failed liveness check when liveness is required', () => {
        expect(gate({ livenessPassed: false }).refusal?.reason).toBe('liveness');
        expect(gate({ livenessPassed: false }, MEMBER, { ...SETTINGS, livenessRequired: false }).refusal).toBeNull();
    });
    it('refuses a face score below the threshold', () => {
        expect(gate({ faceScore: 0.44 }).refusal?.reason).toBe('face_mismatch');
        expect(gate({ faceScore: 0.45 }).refusal).toBeNull();
    });
    it('refuses when no face score was sent at all', () => {
        expect(gate({ faceScore: null }).refusal?.reason).toBe('face_required');
    });
    it('refuses a member who has not enrolled a face', () => {
        const member = { ...MEMBER, enrollmentStatus: 'pending' };
        expect(gate({}, member).refusal?.reason).toBe('not_enrolled');
    });
    it('does NOT require enrolment when the face gate is bypassed', () => {
        const member = { ...MEMBER, enrollmentStatus: 'pending', bypassFace: true };
        expect(gate({}, member).refusal).toBeNull();
    });
    it('requires an integrity token only when the setting demands one', () => {
        const strict = { ...SETTINGS, requirePlayIntegrity: true };
        expect(gate({}, MEMBER, strict).refusal?.reason).toBe('integrity_failed');
        expect(gate({ integrityToken: 'tok' }, MEMBER, strict).refusal).toBeNull();
    });
});
describe('checkGates — what a bypass actually skips', () => {
    const noLocation = { ...MEMBER, bypassLocation: true };
    it('a location bypass skips mock GPS, accuracy AND the geofence together', () => {
        // All three would refuse on their own.
        const r = checkGates({ ...PAYLOAD, isMock: true, accuracy: 9999 }, SETTINGS, bypassOf(noLocation), noLocation, OUTSIDE);
        expect(r.refusal).toBeNull();
        expect(r.distance).toBe(0);
    });
    it('a location bypass does NOT skip the face gate', () => {
        const r = checkGates({ ...PAYLOAD, faceScore: 0.1 }, SETTINGS, bypassOf(noLocation), noLocation, INSIDE);
        expect(r.refusal?.reason).toBe('face_mismatch');
    });
    it('a face bypass does NOT skip the geofence', () => {
        const noFace = { ...MEMBER, bypassFace: true };
        const r = checkGates({ ...PAYLOAD }, SETTINGS, bypassOf(noFace), noFace, OUTSIDE);
        expect(r.refusal?.reason).toBe('out_of_range');
    });
    it('a QR-only branch refuses proximity, and accepts once QR cleared location', () => {
        const member = { ...MEMBER, branch: { ...MEMBER.branch, requireQr: true } };
        const withoutQr = checkGates(PAYLOAD, SETTINGS, bypassOf(member), member, INSIDE);
        expect(withoutQr.refusal?.reason).toBe('qr_required');
        const withQr = checkGates(PAYLOAD, SETTINGS, resolveBypass({ settings: SETTINGS, member, now: NOW, qrAccepted: true }), member, INSIDE);
        expect(withQr.refusal).toBeNull();
    });
});
describe('bypassSnapshot', () => {
    it('is null when nothing was skipped', () => {
        expect(bypassSnapshot(bypassOf())).toBeNull();
    });
    it('records the source so the review screen can explain the row', () => {
        expect(bypassSnapshot(bypassOf({ ...MEMBER, bypassLocation: true }))).toEqual({
            face: false,
            location: true,
            source: 'flag',
            shift_window: false,
        });
    });
    it('is present when only the shift window is off', () => {
        const b = bypassOf(MEMBER, { ...SETTINGS, enforceShiftWindow: false });
        expect(bypassSnapshot(b)).toMatchObject({ shift_window: true });
    });
});
//# sourceMappingURL=gates.test.js.map