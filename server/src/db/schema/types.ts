// Column types drizzle-kit cannot introspect.
//
// `drizzle-kit pull` maps anything it does not recognise to `unknown`, which
// would silently make the geofence and the face embeddings untyped. These
// definitions give them a real TypeScript shape — and, just as importantly,
// document HOW each value must be written, because both are formats you can
// get subtly wrong without an error.
import { customType } from 'drizzle-orm/pg-core';

/**
 * PostGIS `geography(Point, 4326)` — a branch's location.
 *
 * READ-ONLY from the application's point of view. The column is maintained by
 * the `branches_set_geom` trigger from `latitude`/`longitude`, so writing it
 * directly would be overwritten on the next update anyway. Distance is never
 * computed in TypeScript either: `geofence_check()` does it with ST_DWithin,
 * because a client-side answer is a client-side claim.
 *
 * Comes back as WKB hex from the driver; decode it only if you actually need
 * the coordinates, and prefer reading latitude/longitude instead.
 */
export const geography = customType<{
  data: string;
  driverData: string;
  notNull: false;
}>({
  dataType() {
    return 'geography(Point,4326)';
  },
});

/**
 * pgvector `vector(512)` — a face embedding.
 *
 * Postgres wants the literal form `[0.1,0.2,…]`, NOT a Postgres array `{…}`,
 * and the driver would produce the latter for a plain JS array. That mistake
 * fails at insert rather than silently, but the conversion belongs in one place
 * either way.
 *
 * The dimension is fixed at 512 by the MobileFaceNet model the app runs; a
 * vector of any other length is a bug upstream, not something to coerce here.
 */
export const EMBEDDING_DIM = 512;

export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? EMBEDDING_DIM})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    if (Array.isArray(value)) return value as number[];
    try {
      return JSON.parse(value) as number[];
    } catch {
      return [];
    }
  },
});

/**
 * A `date` column — 'yyyy-MM-dd', never a Date.
 *
 * Attendance and roster rows are keyed by calendar date in Africa/Cairo. Handing
 * them to `new Date()` re-interprets them in the process timezone (UTC here) and
 * shifts rows across the midnight boundary — an attendance record that moves to
 * the previous day is a student marked absent.
 */
export const dateOnly = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'date';
  },
});
