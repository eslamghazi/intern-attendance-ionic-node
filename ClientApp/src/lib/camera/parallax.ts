// Depth (3D) liveness: tells a real head apart from a flat photo or a phone
import { CAPTURE } from '../config';
// screen while the user turns their face.
//
// The idea: a printed photo or a replayed video is a PLANE. Whatever you do to
// a plane in front of a camera — rotate it, tilt it, move it — the image points
// move by a single homography. A real head is NOT a plane: the nose sits ~2.5cm
// in front of the cheeks, so turning it shifts the nose sideways much further
// than any plane-to-plane mapping can explain (parallax).
//
// So: fit the best homography from the frontal reference landmarks to the turned
// ones, and measure what it CANNOT explain. Near-zero leftover => flat surface
// => spoof. Large leftover => real 3D face.
//
// Everything is scale/position invariant (Hartley-normalized), so the score does
// not depend on how close the user holds the phone or the camera resolution.

/** Least-squares fit needs at least 4 correspondences; we use the whole mesh. */
const MIN_POINTS = CAPTURE.PARALLAX_MIN_POINTS;

interface Normalized {
  /** Points mapped so the centroid is at 0 and the mean radius is sqrt(2). */
  pts: Float64Array;
}

/** Hartley normalization — keeps the 8x8 solve well conditioned. */
function normalize(p: ArrayLike<number>, n: number): Normalized | null {
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += p[i * 2];
    cy += p[i * 2 + 1];
  }
  cx /= n;
  cy /= n;
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const dx = p[i * 2] - cx;
    const dy = p[i * 2 + 1] - cy;
    dist += Math.hypot(dx, dy);
  }
  dist /= n;
  if (!(dist > 1e-9)) return null; // degenerate: every point in one spot
  const scale = Math.SQRT2 / dist;
  const pts = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    pts[i * 2] = (p[i * 2] - cx) * scale;
    pts[i * 2 + 1] = (p[i * 2 + 1] - cy) * scale;
  }
  return { pts };
}

/** Solve M·x = b for an 8x8 system (Gaussian elimination, partial pivoting). */
function solve8(M: Float64Array, b: Float64Array): Float64Array | null {
  const N = 8;
  for (let col = 0; col < N; col++) {
    let pivot = col;
    for (let r = col + 1; r < N; r++) {
      if (Math.abs(M[r * N + col]) > Math.abs(M[pivot * N + col])) pivot = r;
    }
    if (Math.abs(M[pivot * N + col]) < 1e-12) return null; // singular
    if (pivot !== col) {
      for (let c = 0; c < N; c++) {
        const tmp = M[col * N + c];
        M[col * N + c] = M[pivot * N + c];
        M[pivot * N + c] = tmp;
      }
      const tmp = b[col];
      b[col] = b[pivot];
      b[pivot] = tmp;
    }
    const d = M[col * N + col];
    for (let r = col + 1; r < N; r++) {
      const f = M[r * N + col] / d;
      if (!f) continue;
      for (let c = col; c < N; c++) M[r * N + c] -= f * M[col * N + c];
      b[r] -= f * b[col];
    }
  }
  const x = new Float64Array(N);
  for (let r = N - 1; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < N; c++) s -= M[r * N + c] * x[c];
    x[r] = s / M[r * N + r];
  }
  return x;
}

/**
 * How much of the motion between two landmark sets a plane CANNOT explain.
 *
 * `ref` and `cur` are the same landmarks in two poses, flat `[x0,y0,x1,y1,...]`
 * (any consistent units — normalized 0..1 or pixels).
 *
 * Returns a dimensionless residual: roughly "leftover error as a fraction of
 * face size". A plane scores at noise level (~0.005-0.015); a real head turned
 * 20°+ scores several times higher. Returns 0 when it cannot decide (too few
 * points, degenerate geometry) so callers treat "unknown" as "not proven live".
 */
export function parallaxScore(ref: ArrayLike<number>, cur: ArrayLike<number>): number {
  const n = Math.min(ref.length, cur.length) >> 1;
  if (n < MIN_POINTS) return 0;
  const a = normalize(ref, n);
  const b = normalize(cur, n);
  if (!a || !b) return 0;

  // Normal equations for the 8-parameter homography (h33 fixed at 1):
  //   [x y 1 0 0 0 -ux -uy]·h = u      [0 0 0 x y 1 -vx -vy]·h = v
  const M = new Float64Array(64);
  const rhs = new Float64Array(8);
  const row = new Float64Array(8);
  const accumulate = (val: number) => {
    for (let r = 0; r < 8; r++) {
      if (!row[r]) continue;
      for (let c = 0; c < 8; c++) M[r * 8 + c] += row[r] * row[c];
      rhs[r] += row[r] * val;
    }
  };
  for (let i = 0; i < n; i++) {
    const x = a.pts[i * 2];
    const y = a.pts[i * 2 + 1];
    const u = b.pts[i * 2];
    const v = b.pts[i * 2 + 1];
    row.set([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    accumulate(u);
    row.set([0, 0, 0, x, y, 1, -v * x, -v * y]);
    accumulate(v);
  }
  const h = solve8(M, rhs);
  if (!h) return 0;

  // Reprojection error per point, in normalized units (face size ~ sqrt(2)).
  const errs = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = a.pts[i * 2];
    const y = a.pts[i * 2 + 1];
    const w = h[6] * x + h[7] * y + 1;
    if (Math.abs(w) < 1e-9) return 0;
    const px = (h[0] * x + h[1] * y + h[2]) / w;
    const py = (h[3] * x + h[4] * y + h[5]) / w;
    errs[i] = Math.hypot(px - b.pts[i * 2], py - b.pts[i * 2 + 1]);
  }

  // Most of a face IS roughly planar (forehead, cheeks) — the parallax lives in
  // the nose/chin. So score the worst fifth of the points, not the average, and
  // divide by the normalized face size so the result is dimensionless.
  errs.sort();
  const tail = Math.max(1, Math.round(n * 0.2));
  let sum = 0;
  for (let i = n - tail; i < n; i++) sum += errs[i];
  return sum / tail / Math.SQRT2;
}

/**
 * How "wide vs tall" the landmark cloud is, measured on its own principal axes
 * (so tilting the head — roll — does not change it).
 *
 * Turning the head compresses the face horizontally by cos(yaw), so comparing
 * this against the frontal value recovers the turn angle without depending on
 * specific landmark indices or on any pose matrix the detector may or may not
 * emit. It is only a GATE ("did they turn far enough to measure depth?") — the
 * proof of life is parallaxScore, so a faked aspect ratio gains nothing.
 */
export function faceAspect(p: ArrayLike<number>): number {
  const n = p.length >> 1;
  if (n < MIN_POINTS) return 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += p[i * 2];
    cy += p[i * 2 + 1];
  }
  cx /= n;
  cy /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = p[i * 2] - cx;
    const dy = p[i * 2 + 1] - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  sxx /= n;
  syy /= n;
  sxy /= n;
  const tr = sxx + syy;
  const disc = Math.sqrt(Math.max((tr * tr) / 4 - (sxx * syy - sxy * sxy), 0));
  const major = tr / 2 + disc;
  const minor = tr / 2 - disc;
  if (major < 1e-12) return 0;
  return Math.sqrt(Math.max(minor, 0) / major);
}

/** Turn angle in degrees from the frontal aspect ratio to the current one. */
export function turnDegrees(frontalAspect: number, aspect: number): number {
  if (frontalAspect <= 0 || aspect <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, aspect / frontalAspect));
  return (Math.acos(ratio) * 180) / Math.PI;
}

/** Middle value of a sample list (the samples are noisy frame by frame). */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
