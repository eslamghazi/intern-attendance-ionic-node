// Geofencing helpers. Distance here is a client-side UX hint ONLY — a number
import { EARTH_RADIUS_M as R_EARTH_M } from './config';
// the user can see moving as they walk. The authoritative answer is recomputed
// by the server from the branch row on every check-in
// (server/src/domain/attendance/geofence.ts), and a client-side claim about
// position is never trusted.

// Defined in config.ts — see there for why the client's figure is allowed to
// differ from the server's ellipsoid.
const EARTH_RADIUS_M = R_EARTH_M;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in metres between two lat/lng points. */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isWithinRadius(
  pointLat: number,
  pointLng: number,
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
): boolean {
  return haversineMeters(pointLat, pointLng, centerLat, centerLng) <= radiusMeters;
}
