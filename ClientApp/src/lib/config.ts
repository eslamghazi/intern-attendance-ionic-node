// Centralized app constants: tunables, sizes, defaults and magic values.
// Anything here is a knob you might reasonably want to change in one place.

/** Storage buckets. `avatars` is public (profile photos); the rest are private. */
export const BUCKETS = {
  faces: 'faces',
  probes: 'probes',
  avatars: 'avatars',
} as const;
export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

/** Base URL for the large ML assets (models + mediapipe wasm). Hosted on a
 *  separate GitHub repo and served via jsDelivr, so this repo stays light. The
 *  remote keeps the same layout: <base>/models/... and <base>/mediapipe/wasm/...
 *  Override with VITE_MODEL_BASE_URL if you ever move them; empty string there
 *  falls back to this default. Use '' to serve from this app's own public/. */
const DEFAULT_ASSET_BASE = 'https://cdn.jsdelivr.net/gh/eslamghazi/redirctDownInternAttendance@V1';
export const ASSET_BASE = ((import.meta.env.VITE_MODEL_BASE_URL ?? '') || DEFAULT_ASSET_BASE).replace(
  /\/$/,
  '',
);

/** Face recognition (ONNX MobileFaceNet). */
export const FACE = {
  modelUrl: `${ASSET_BASE}/models/mobilefacenet.onnx`,
  /** Base folder for the MediaPipe vision wasm runtime (FilesetResolver). */
  mediapipeWasm: `${ASSET_BASE}/mediapipe/wasm`,
  /** MediaPipe face-landmarker task (liveness). */
  landmarkerModel: `${ASSET_BASE}/models/face_landmarker.task`,
  wasmPaths: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/',
  inputSize: 112,
  embeddingDim: 512,
  /** Fallback cosine threshold when app_settings is unavailable. Kept lenient
   *  (MobileFaceNet genuine-match scores vary a lot with lighting/pose); the
   *  admin can tighten it via the face_match_threshold setting. */
  defaultMatchThreshold: 0.45,
} as const;

/** Liveness thresholds. The first block is the expression (action) challenge
 *  via ML Kit / MediaPipe; the second is the head-turn depth check. */
export const LIVENESS = {
  eyeOpen: 0.6,
  eyeClosed: 0.4,
  smileActive: 0.7,
  smileRest: 0.3,
  headTurnDeg: 18,
  headFrontalDeg: 10,

  // --- head-turn (3D) challenge, see lib/camera/parallax.ts ---
  /** How far the head must turn before the depth check is measured. Below ~20°
   *  a real nose barely moves, so there is no parallax to tell apart. */
  turnDeg: 22,
  /** When the face counts as facing the camera again (photo is taken frontal —
   *  the face embedding is trained on frontal faces). */
  frontalDeg: 10,
  /** Still, frontal frames used to learn this device's landmark jitter. */
  noiseSamples: 6,
  /** Turned frames needed before deciding. */
  turnSamples: 3,
  /** Re-prompt after this many turned frames that still look flat. */
  turnRetrySamples: 12,
  /** Absolute minimum "motion a plane cannot explain" for a real face. */
  parallaxFloor: 0.05,
  /** ...and it must also beat the measured jitter baseline by this factor. */
  parallaxRatio: 1.8,
  /** A turned face is narrower on screen — don't drop it mid-challenge. */
  turnMinFaceSize: 0.13,
} as const;

/** Geolocation / geofence defaults (the server is authoritative). */
export const LOCATION = {
  highAccuracyTimeoutMs: 15_000,
  defaultRadiusMeters: 150,
  defaultMaxAccuracyMeters: 50,
  // Mock-GPS detection: sampling a real fix lets the native detector read
  // Android's isFromMockProvider flag (the strongest anti-spoof signal).
  mockSampleTimeoutMs: 8_000,
  // Treat a fix as spoofed at/above this layered risk score even if the OS
  // mock flag itself is not set (e.g. rooted devices hiding the flag).
  mockRiskThreshold: 0.6,
  // Web-only anti-spoof: a DevTools/CDP location override fakes the Geolocation
  // API but not the network, so the real IP still resolves to the true area. If
  // the GPS fix is more than this many km from the IP location, treat it as
  // spoofed. Generous, because IP geolocation (esp. mobile carriers) is coarse.
  ipMismatchKm: 100,
  ipLookupTimeoutMs: 4_000,
  // Web-only "frozen GPS" check: a real phone chip jitters a few metres between
  // reads; a mock app usually feeds a constant. Sample N fixes and flag when the
  // spread stays below the floor. Spacing must exceed the ~1 Hz GPS refresh so a
  // real fix has a chance to move.
  gpsJitterSamples: 4,
  gpsJitterIntervalMs: 1_100,
  gpsJitterMinMeters: 0.7,
  gpsSampleTimeoutMs: 6_000,
} as const;

/** Shift / attendance defaults (mirrors app_settings fallbacks). */
export const SHIFT = {
  defaultStart: '07:00',
  defaultEnd: '17:00',
  defaultLateGraceMinutes: 30,
  earlyGraceMinutes: 60,
} as const;

/** Leaflet map picker defaults (Kafr El Sheikh city centre). */
export const MAP = {
  defaultCenter: [31.1107, 30.9388] as [number, number],
  defaultZoom: 11,
  pointZoom: 15,
  reviewRadiusMeters: 50,
  pickerHeight: 300,
  reviewHeight: 240,
} as const;

/** React Query defaults. */
export const QUERY = {
  staleTimeMs: 30_000,
  retry: 1,
} as const;

/** Seconds a signed image URL stays valid for admin review. */
export const SIGNED_URL_TTL_SECONDS = 120;

/** Longer TTL used while EXPORTING images: a bulk download of a few hundred
 *  files takes longer than the viewing window, and a URL that expires mid-zip
 *  loses files silently. */
export const EXPORT_URL_TTL_SECONDS = 900;

/** Egyptian national ID length. */
export const NATIONAL_ID_LENGTH = 14;

/** Debounce (ms) before a search box fires — used everywhere search exists. */
export const SEARCH_DEBOUNCE_MS = 1000;

/** Operational timezone — all dates/times are interpreted and shown here. */
export const APP_TIMEZONE = 'Africa/Cairo';

/** Rows per page for the admin server-side paginated lists/grids. */
export const PAGE_SIZE = 12;

/** Max rows fetched (unpaginated) when building a printable report. */
export const REPORT_PAGE_SIZE = 5000;

/**
 * Largest page the API will return for a listing endpoint. It caps `page_size`
 * server-side too, so asking for more is refused rather than silently truncated
 * — which is what PostgREST used to do, and the reason the old client had to
 * window every growing query by hand.
 */
export const MAX_PAGE_SIZE = 5000;

/** Calendar months 1..12 (for month pickers). */
export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Widest month has 31 days — used for the roster template columns. */
export const ROSTER_MAX_DAYS = 31;

/** Rows per group when bulk-upserting roster days. */
export const UPSERT_BATCH_SIZE = 500;

/** How long the fetched server date stays fresh before refetching. */
export const SERVER_TIME_STALE_MS = 60_000;

/** Toast auto-dismiss durations (ms) by intent. */
export const TOAST_MS = {
  brief: 1500,
  short: 2000,
  medium: 2500,
  long: 3000,
} as const;

/** Vendor / licensing — the app is licensed by Calaix AI. */
export const CALAIX = {
  name: 'Calaix AI',
  url: 'https://calaixai.com',
  logo: '/Calaix_Logos/Calaix_AI.svg',
  icon: '/Calaix_Logos/calaix-icon.svg',
} as const;
