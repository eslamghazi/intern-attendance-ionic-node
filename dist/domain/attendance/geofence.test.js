// The geofence, checked against the behaviour it replaces.
//
// geofence_check() was SQL over PostGIS and had no tests at all — it could not
// have any, short of a live database with the extension installed. That is half
// the reason for moving it here.
//
// Coordinates are around Kafr El Sheikh (31.11 N, 30.94 E), so the latitude
// scaling is the real one rather than something convenient near the equator.
import { describe, it, expect } from 'vitest';
import { evaluateGeofence, readRing } from './geofence.js';
const BRANCH = {
    latitude: 31.1107,
    longitude: 30.9388,
    radiusMeters: 150,
    areaCoords: null,
};
/** The same place, in the shape a fix takes. */
const CENTRE = { lat: BRANCH.latitude, lng: BRANCH.longitude };
/**
 * Metres per degree at a given latitude — the published WGS84 series expansion.
 *
 * Deliberately a DIFFERENT derivation from the module's, which works from the
 * meridional and prime-vertical radii of curvature. Same answer, arrived at
 * another way: the two agree to about 5 cm per kilometre, so this is a real
 * oracle rather than the module grading its own homework.
 *
 * The first attempt at this helper used 110574 m per degree of latitude — the
 * value at the EQUATOR — which is 0.27% short here and made every distance
 * assertion fail by ~2.7 m per km. That failure was the module being right.
 */
function metresPerDegree(latDeg) {
    const p = latDeg * (Math.PI / 180);
    return {
        lat: 111132.92 - 559.82 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p) - 0.0023 * Math.cos(6 * p),
        lng: 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p) + 0.118 * Math.cos(5 * p),
    };
}
/** Metres north/east of the branch centre, as a coordinate. */
function offset(north, east, from = CENTRE) {
    const per = metresPerDegree(from.lat);
    return { lat: from.lat + north / per.lat, lng: from.lng + east / per.lng };
}
describe('circle geofence', () => {
    it('the centre is inside, at zero distance', () => {
        const r = evaluateGeofence(BRANCH, CENTRE);
        expect(r.within).toBe(true);
        expect(r.distanceM).toBeCloseTo(0, 6);
        expect(r.radiusM).toBe(150);
    });
    it('100 m north is inside a 150 m radius', () => {
        const r = evaluateGeofence(BRANCH, offset(100, 0));
        expect(r.within).toBe(true);
        expect(r.distanceM).toBeCloseTo(100, 0);
    });
    it('100 m east is inside, and measures the same as 100 m north', () => {
        const north = evaluateGeofence(BRANCH, offset(100, 0));
        const east = evaluateGeofence(BRANCH, offset(0, 100));
        expect(east.within).toBe(true);
        // The two directions use different radii of curvature. If the module used
        // one mean radius they would still be equal — but both would be wrong.
        expect(east.distanceM).toBeCloseTo(north.distanceM, 0);
    });
    it('200 m away is outside, and says how far', () => {
        const r = evaluateGeofence(BRANCH, offset(200, 0));
        expect(r.within).toBe(false);
        expect(r.distanceM).toBeCloseTo(200, 0);
        expect(r.radiusM).toBe(150);
    });
    it('exactly on the radius counts as inside, as ST_DWithin did', () => {
        // ST_DWithin is inclusive: `<=`, not `<`.
        const onEdge = evaluateGeofence(BRANCH, offset(150, 0));
        expect(onEdge.distanceM).toBeCloseTo(150, 1);
        expect(evaluateGeofence({ ...BRANCH, radiusMeters: Math.ceil(onEdge.distanceM) }, offset(150, 0)).within).toBe(true);
    });
    it('distance grows with the diagonal, not with one axis', () => {
        const r = evaluateGeofence(BRANCH, offset(100, 100));
        // 141 m, not 100 — a per-axis comparison would call this inside twice over.
        expect(r.distanceM).toBeCloseTo(Math.hypot(100, 100), 0);
        expect(r.within).toBe(true); // 141 < 150
    });
});
describe('projection accuracy', () => {
    // The reason for using the WGS84 radii of curvature rather than a mean Earth
    // radius. A sphere of R = 6371008.8 m is wrong by ~0.29% north / ~0.20% east
    // at this latitude; at 1 km that is ~3 m, which is the sort of error that
    // makes a geofence argument unwinnable.
    it('agrees with the geodesic distance to well under a metre at 1 km', () => {
        const r = evaluateGeofence({ ...BRANCH, radiusMeters: 5000 }, offset(1000, 0));
        expect(Math.abs(r.distanceM - 1000)).toBeLessThan(1);
    });
    it('is symmetric: A to B measures the same as B to A', () => {
        const b = offset(300, 400);
        const there = evaluateGeofence({ ...BRANCH, radiusMeters: 5000 }, b);
        const back = evaluateGeofence({ latitude: b.lat, longitude: b.lng, radiusMeters: 5000, areaCoords: null }, CENTRE);
        expect(there.distanceM).toBeCloseTo(back.distanceM, 1);
    });
});
/** A 400 m square centred on the branch. */
// A tuple, not an array: readRing now takes JsonValue, which has no room for
// the `undefined` that indexing an array yields under noUncheckedIndexedAccess.
const SQUARE = [
    offset(-200, -200),
    offset(-200, 200),
    offset(200, 200),
    offset(200, -200),
];
describe('polygon geofence', () => {
    const polygon = { ...BRANCH, radiusMeters: 20, areaCoords: SQUARE };
    it('the polygon wins over the circle', () => {
        // 180 m out: far outside the 20 m radius, but well inside the square.
        const r = evaluateGeofence(polygon, offset(180, 0));
        expect(r.within).toBe(true);
        expect(r.distanceM).toBe(0); // ST_Distance is 0 for a covered point
    });
    it('still reports the radius, for the message the client builds', () => {
        expect(evaluateGeofence(polygon, offset(180, 0)).radiusM).toBe(20);
    });
    it('outside the square measures to the nearest EDGE, not to the centre', () => {
        const r = evaluateGeofence(polygon, offset(250, 0));
        expect(r.within).toBe(false);
        expect(r.distanceM).toBeCloseTo(50, 0); // 250 - 200, not 250
    });
    it('a point on the boundary is covered, as ST_Covers had it', () => {
        expect(evaluateGeofence(polygon, offset(200, 0)).within).toBe(true);
    });
    it('a point level with a vertex is not miscounted', () => {
        // The ray from this point passes exactly through two corners. Without the
        // half-open crossing rule it would cross both edges at each and cancel out.
        expect(evaluateGeofence(polygon, offset(200, -50)).within).toBe(true);
        expect(evaluateGeofence(polygon, offset(-200, 50)).within).toBe(true);
    });
    it('handles a ring that is already closed', () => {
        const closed = [...SQUARE, SQUARE[0]];
        expect(evaluateGeofence({ ...polygon, areaCoords: closed }, offset(0, 0)).within).toBe(true);
        expect(evaluateGeofence({ ...polygon, areaCoords: closed }, offset(250, 0)).within).toBe(false);
    });
    it('handles a concave polygon — the notch is outside', () => {
        // An L: the top-right quadrant is cut away.
        const L = [
            offset(-200, -200),
            offset(-200, 200),
            offset(0, 200),
            offset(0, 0),
            offset(200, 0),
            offset(200, -200),
        ];
        const branch = { ...polygon, areaCoords: L };
        expect(evaluateGeofence(branch, offset(-100, 100)).within).toBe(true); // filled
        expect(evaluateGeofence(branch, offset(100, 100)).within).toBe(false); // the notch
        expect(evaluateGeofence(branch, offset(100, -100)).within).toBe(true); // filled
    });
    it('winding order does not matter', () => {
        const reversed = [...SQUARE].reverse();
        expect(evaluateGeofence({ ...polygon, areaCoords: reversed }, offset(0, 0)).within).toBe(true);
        expect(evaluateGeofence({ ...polygon, areaCoords: reversed }, offset(250, 0)).within).toBe(false);
    });
});
describe('readRing — the validation PostGIS used to do', () => {
    it('accepts a well-formed ring', () => {
        expect(readRing(SQUARE)).toHaveLength(4);
    });
    it('treats fewer than three vertices as "circle mode", not as an error', () => {
        // Matches the branches_set_geom trigger: `jsonb_array_length >= 3`, else null.
        expect(readRing([])).toBeNull();
        expect(readRing([SQUARE[0], SQUARE[1]])).toBeNull();
        expect(readRing(null)).toBeNull();
    });
    it('rejects out-of-range coordinates, which the geography type used to reject', () => {
        expect(readRing([{ lat: 310.5, lng: 30 }, SQUARE[1], SQUARE[2]])).toBeNull();
        expect(readRing([{ lat: 31, lng: 999 }, SQUARE[1], SQUARE[2]])).toBeNull();
    });
    it('rejects non-numeric, NaN and malformed entries', () => {
        expect(readRing([{ lat: '31', lng: 30 }, SQUARE[1], SQUARE[2]])).toBeNull();
        expect(readRing([{ lat: NaN, lng: 30 }, SQUARE[1], SQUARE[2]])).toBeNull();
        expect(readRing([{ lat: 31 }, SQUARE[1], SQUARE[2]])).toBeNull();
        expect(readRing([null, SQUARE[1], SQUARE[2]])).toBeNull();
        expect(readRing('not an array')).toBeNull();
    });
    it('falls back to the circle when the polygon is unusable', () => {
        // A bad polygon must not open the gate, and must not throw mid-check-in.
        const broken = { ...BRANCH, areaCoords: [{ lat: 999, lng: 999 }, SQUARE[1], SQUARE[2]] };
        const r = evaluateGeofence(broken, offset(200, 0));
        expect(r.within).toBe(false); // judged by the 150 m circle
        expect(r.distanceM).toBeCloseTo(200, 0);
    });
});
//# sourceMappingURL=geofence.test.js.map