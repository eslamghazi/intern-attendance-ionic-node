// Is this fix inside the branch?
//
// The geofence decides whether a check-in is accepted, so it is the rule most
// worth being able to test exhaustively: a pure function over coordinates, with
// a test suite that runs in milliseconds and needs nothing running.
//
// Keeping it here is also what keeps the database free of a geospatial
// extension — this is the only thing that would have wanted one.
//
// WHY A LOCAL TANGENT PLANE, NOT HAVERSINE
//
// Haversine gives distance on a sphere and nothing else. Two of the four things
// needed here — "is this point inside that polygon" and "how far is it from the
// nearest edge" — are not distance questions, and doing them on a sphere means
// great-circle arcs, spherical excess and winding numbers.
//
// Projecting onto a plane tangent at the branch turns all four into ordinary
// 2-D geometry that is easy to read and easy to test. The cost is distortion
// that grows with distance from the origin, and at geofence range (a radius is
// capped at 5 km by a CHECK constraint, and is typically 150 m) it is far below
// a millimetre.
//
// The projection uses the WGS84 radii of curvature AT THIS LATITUDE rather than
// a mean Earth radius. That is the difference between agreeing with PostGIS to
// within a centimetre and disagreeing with it by ~30 cm in 100 m — not that
// either matters against a phone's 5-20 m of GPS error, but there is no reason
// to accept an error that costs two extra lines to remove.
//
// AGREEING WITH WHAT CAME BEFORE
//
// ST_Covers treats a point ON the boundary as covered, and ST_Distance returns
// 0 for a point inside a polygon. Both are matched deliberately; see below.

import {
  BOUNDARY_TOLERANCE_M as TOLERANCE_M,
  DEG,
  WGS84_A,
  WGS84_E2,
} from '../../config/constants.js';
import type { JsonValue } from '../../common/json.types.js';
import type { BranchGeofence, GeofenceResult, LatLng } from './types.js';
export type { BranchGeofence, GeofenceResult, LatLng } from './types.js';

// WGS84, from config/constants.ts — anything else doing geodesy must use the
// same ellipsoid or two answers disagree by metres.
const A = WGS84_A;
const E2 = WGS84_E2;

/**
 * Metres per radian, north and east, at this latitude.
 *
 * `north` is the meridional radius of curvature and `east` the prime-vertical
 * one scaled by cos(latitude) — the two directions distort differently, which
 * is exactly what using a single mean radius gets wrong.
 */
function metresPerRadian(latDeg: number): { north: number; east: number } {
  const phi = latDeg * DEG;
  const sin = Math.sin(phi);
  const w = 1 - E2 * sin * sin;
  return {
    north: (A * (1 - E2)) / (w * Math.sqrt(w)),
    east: (A / Math.sqrt(w)) * Math.cos(phi),
  };
}

interface Point {
  x: number;
  y: number;
}

/** Project onto the plane tangent at `origin`, in metres east/north. */
function project(p: LatLng, origin: LatLng, scale: { north: number; east: number }): Point {
  return {
    x: (p.lng - origin.lng) * DEG * scale.east,
    y: (p.lat - origin.lat) * DEG * scale.north,
  };
}

/** Shortest distance from `p` to the segment `a`-`b`. */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  // A degenerate edge — which a closed ring always has one of, where the last
  // vertex repeats the first.
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  // Where the perpendicular falls, clamped to the segment's ends.
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Ray casting: count the crossings of a ray going east from `p`.
 *
 * The `(a.y > p.y) !== (b.y > p.y)` test is half-open in y on purpose. A ray
 * that passes exactly through a vertex would otherwise cross both of the edges
 * meeting there and cancel itself out, putting an inside point outside. The
 * half-open rule counts each vertex for one of its two edges only.
 *
 * Says nothing useful about a point ON the boundary, which is why the caller
 * checks the boundary distance first rather than relying on this.
 */
function insideRing(p: Point, ring: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.y > p.y !== b.y > p.y) {
      const crossingX = a.x + ((p.y - a.y) / (b.y - a.y)) * (b.x - a.x);
      if (p.x < crossingX) inside = !inside;
    }
  }
  return inside;
}

/**
 * A point is "on the boundary" within this many metres.
 *
 * ST_Covers counted the boundary as inside. Floating point will not land a fix
 * exactly on an edge, so matching that needs a tolerance — and it has to be one
 * that is meaningless as a position (a millimetre) rather than one that quietly
 * widens the geofence.
 */
const BOUNDARY_TOLERANCE_M = TOLERANCE_M;

/**
 * Read `area_coords` into a ring, or null if it does not describe a polygon.
 *
 * NOT trusted: this column is plain jsonb, so anything can be in it. It used to
 * be fed to ST_GeomFromGeoJSON, which rejected out-of-range coordinates and an
 * unclosed ring — validation that disappears with PostGIS, so it happens here.
 *
 * Fewer than three vertices is not an error: it is how the admin UI stores
 * "circle mode", and it matches what the branches_set_geom trigger did
 * (`jsonb_array_length >= 3`, else `area := null`).
 *
 * A ring may arrive closed (last vertex repeating the first) or not. Both work:
 * the ray cast wraps around anyway, and the zero-length edge a closed ring adds
 * contributes nothing to either answer.
 */
export function readRing(areaCoords: JsonValue): LatLng[] | null {
  if (!Array.isArray(areaCoords) || areaCoords.length < 3) return null;

  const ring: LatLng[] = [];
  for (const entry of areaCoords) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null;
    const { lat, lng } = entry;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    ring.push({ lat, lng });
  }
  return ring.length >= 3 ? ring : null;
}

/**
 * Distance from the branch, and whether the fix is inside it.
 *
 * A polygon wins over the circle when one is set, exactly as geofence_check
 * did: `case when h.area is not null then ST_Covers(...) else ST_DWithin(...)`.
 *
 * `radiusM` is returned in both modes, because the client shows it beside the
 * distance in the "you are too far" message. In polygon mode it does not take
 * part in the decision.
 */
export function evaluateGeofence(branch: BranchGeofence, fix: LatLng): GeofenceResult {
  const origin: LatLng = { lat: branch.latitude, lng: branch.longitude };
  const scale = metresPerRadian(branch.latitude);
  const p = project(fix, origin, scale);

  const ring = readRing(branch.areaCoords);

  if (!ring) {
    // Circle: ST_Distance to the centre, ST_DWithin against the radius.
    const distanceM = Math.hypot(p.x, p.y);
    return { within: distanceM <= branch.radiusMeters, distanceM, radiusM: branch.radiusMeters };
  }

  const projected = ring.map((v) => project(v, origin, scale));

  // Nearest edge first: it answers the boundary case, and it is the distance to
  // report when the fix is outside.
  let toBoundary = Infinity;
  for (let i = 0, j = projected.length - 1; i < projected.length; j = i++) {
    const d = distanceToSegment(p, projected[i]!, projected[j]!);
    if (d < toBoundary) toBoundary = d;
  }

  const within = toBoundary <= BOUNDARY_TOLERANCE_M || insideRing(p, projected);

  // ST_Distance(polygon, point) is 0 for a point the polygon covers.
  return {
    within,
    distanceM: within ? 0 : toBoundary,
    radiusM: branch.radiusMeters,
  };
}
