import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { MockLocationDetector } from '@capgo/capacitor-mock-location-detector';
import { LOCATION } from '../config';
import { haversineMeters } from '../geo';

export interface LocationReading {
  lat: number;
  lng: number;
  accuracy: number;
  /** True if the OS / detector flags the location as simulated. */
  isMock: boolean;
  /** 0..1 risk score from the layered mock detector (native only). */
  mockRisk: number;
  /** True if Android Developer Options are enabled (native only). */
  devMode: boolean;
}

const isNative = Capacitor.isNativePlatform();

export async function ensureLocationPermission(): Promise<boolean> {
  if (!isNative) return true; // browser prompts on getCurrentPosition
  try {
    const status = await Geolocation.checkPermissions();
    if (status.location === 'granted') return true;
    const req = await Geolocation.requestPermissions();
    return req.location === 'granted';
  } catch {
    return false;
  }
}

/**
 * Best-effort web spoof detection. The browser exposes no OS mock flag, but the
 * common "fake GPS" tools work by monkey-patching navigator.geolocation with a
 * JS shim — a native function's source contains `[native code]`, a shim's does
 * not. We also flag automation drivers. This catches extension/DevTools-script
 * spoofers; a raw DevTools sensor override is invisible to JS and cannot be
 * caught here (documented limitation).
 */
function detectMockWeb(): { isMock: boolean; risk: number } {
  let risk = 0;
  try {
    const geo = navigator.geolocation as unknown as Record<string, unknown>;
    const isNativeFn = (fn: unknown) =>
      typeof fn === 'function' &&
      /\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(fn));
    // A fake-GPS extension replaces these with its own JS implementation.
    if (!isNativeFn(geo?.getCurrentPosition) || !isNativeFn(geo?.watchPosition)) {
      risk = Math.max(risk, 0.8);
    }
    // Headless / automation drivers (Selenium, Puppeteer) spoof location freely.
    if ((navigator as unknown as { webdriver?: boolean }).webdriver) {
      risk = Math.max(risk, 0.7);
    }
  } catch {
    /* If anything about the environment is unreadable, don't guess. */
  }
  return { isMock: risk >= LOCATION.mockRiskThreshold, risk };
}

/** Layered mock-GPS detection. Native uses the OS detector; web uses heuristics. */
async function detectMock(): Promise<{ isMock: boolean; risk: number; devMode: boolean }> {
  if (!isNative) return { ...detectMockWeb(), devMode: false };
  try {
    // requestLocationSample:true is essential — it makes the native layer pull a
    // real fix and inspect Android's isFromMockProvider (system_mock_flag) plus
    // the provider/anomaly checks. Without a sample those checks are skipped and
    // a mock-location app slips through undetected.
    const res = await MockLocationDetector.analyze({
      requestLocationSample: true,
      locationTimeoutMs: LOCATION.mockSampleTimeoutMs,
    });
    const risk = res.riskScore ?? 0;
    // Flag on the detector's own verdict OR a high layered risk score, so a
    // rooted device that hides the OS mock flag is still caught.
    return {
      isMock: res.isSimulated || risk >= LOCATION.mockRiskThreshold,
      risk,
      devMode: !!res.developerMode?.detected,
    };
  } catch {
    // If the detector is unavailable, fail safe by NOT flagging — the server
    // still enforces the geofence and accuracy gates.
    return { isMock: false, risk: 0, devMode: false };
  }
}

/** Deep-link to the OS Developer Options screen so a member can turn it off. */
export async function openDeveloperSettings(): Promise<void> {
  if (!isNative) return;
  try {
    await MockLocationDetector.openDeveloperSettings();
  } catch {
    // No-op: some OEMs hide the screen; the member can open it manually.
  }
}

/** Coarse IP-based location of the caller (web only). null on any failure. */
async function ipCoarseLocation(): Promise<{ lat: number; lng: number } | null> {
  // Two independent providers, both HTTPS + CORS-enabled + keyless. First win.
  const endpoints = ['https://ipwho.is/', 'https://get.geojs.io/v1/ip/geo.json'];
  for (const url of endpoints) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), LOCATION.ipLookupTimeoutMs);
      const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
      if (!res.ok) continue;
      const j = (await res.json()) as Record<string, unknown>;
      const lat = Number(j.latitude ?? j.lat);
      const lng = Number(j.longitude ?? j.lng ?? j.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    } catch {
      /* try the next provider */
    }
  }
  return null;
}

/**
 * Web-only "frozen GPS" heuristic. A physical GPS receiver jitters a few metres
 * between reads even when the device is still; a mock-location app that feeds a
 * fixed point returns byte-identical coordinates. We take several spaced,
 * high-accuracy fixes and flag when their spread is essentially zero. Fail-open
 * on any error. NOTE: a mock app configured to add random movement evades this,
 * and a stationary phone on a heavily-smoothed fused fix can trip it — hence it
 * is admin opt-in.
 */
async function detectFrozenGps(): Promise<boolean> {
  try {
    const reads: { lat: number; lng: number }[] = [];
    for (let i = 0; i < LOCATION.gpsJitterSamples; i++) {
      const p = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: LOCATION.gpsSampleTimeoutMs,
        }),
      );
      reads.push({ lat: p.coords.latitude, lng: p.coords.longitude });
      if (i < LOCATION.gpsJitterSamples - 1) {
        await new Promise((r) => setTimeout(r, LOCATION.gpsJitterIntervalMs));
      }
    }
    let maxMeters = 0;
    for (const a of reads)
      for (const b of reads)
        maxMeters = Math.max(maxMeters, haversineMeters(a.lat, a.lng, b.lat, b.lng));
    return maxMeters < LOCATION.gpsJitterMinMeters;
  } catch {
    return false;
  }
}

export async function getLocation(opts?: {
  ipMaxKm?: number;
  detectFrozen?: boolean;
}): Promise<LocationReading> {
  const [pos, mock] = await Promise.all([
    Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: LOCATION.highAccuracyTimeoutMs,
      maximumAge: 0,
    }),
    detectMock(),
  ]);

  let isMock = mock.isMock;
  let mockRisk = mock.risk;

  // Web only: cross-check the GPS fix against the network's IP location. A
  // DevTools/CDP override or an Android mock app fakes GPS but not the IP, so a
  // large gap between the two exposes it — but ONLY when the fake spot is far
  // from the real network. A threshold of 0 disables the check. Fail-open on any
  // lookup error.
  const ipMaxKm = opts?.ipMaxKm ?? LOCATION.ipMismatchKm;
  if (!isNative && !isMock && ipMaxKm > 0) {
    const ip = await ipCoarseLocation();
    if (ip) {
      const gapKm = haversineMeters(pos.coords.latitude, pos.coords.longitude, ip.lat, ip.lng) / 1000;
      if (gapKm > ipMaxKm) {
        isMock = true;
        mockRisk = Math.max(mockRisk, 0.9);
      }
    }
  }

  // Web only, opt-in: a mock app feeding a constant point leaves the GPS frozen.
  if (!isNative && !isMock && opts?.detectFrozen) {
    if (await detectFrozenGps()) {
      isMock = true;
      mockRisk = Math.max(mockRisk, 0.85);
    }
  }

  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? 9999,
    isMock,
    mockRisk,
    devMode: mock.devMode,
  };
}
