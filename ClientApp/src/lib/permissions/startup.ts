// Proactively request every permission the app needs (camera + location) on app
// open, so a member grants them upfront instead of hitting prompts in the middle
// of enrollment or check-in — and so we can warn them when one is missing. Runs
// once per app load; returns which permissions ended up granted.
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';

export interface PermissionStatus {
  camera: boolean;
  location: boolean;
}

let started = false;
let lastStatus: PermissionStatus = { camera: true, location: true };

const isNative = Capacitor.isNativePlatform();

async function ensureLocation(): Promise<boolean> {
  try {
    if (isNative) {
      let st = await Geolocation.checkPermissions();
      if (st.location !== 'granted' && st.coarseLocation !== 'granted') {
        st = await Geolocation.requestPermissions();
      }
      return st.location === 'granted' || st.coarseLocation === 'granted';
    }
    if (!navigator.geolocation) return false;
    // Web: trigger the browser prompt once (resolves on grant OR deny).
    return await new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { timeout: 10000, maximumAge: 60000 },
      );
    });
  } catch {
    return false;
  }
}

async function ensureCamera(): Promise<boolean> {
  try {
    if (isNative) {
      let st = await Camera.checkPermissions();
      if (st.camera !== 'granted') st = await Camera.requestPermissions({ permissions: ['camera'] });
      return st.camera === 'granted';
    }
    // Web: probe getUserMedia to trigger the prompt, then release the camera
    // immediately (no visible flash) so it's granted before the real capture.
    if (!navigator.mediaDevices?.getUserMedia) return false;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    stream.getTracks().forEach((tr) => tr.stop());
    return true;
  } catch {
    return false;
  }
}

/** Request the app's permissions once on open (call once we know the user is a
 *  member). Returns which are granted so the UI can warn about the rest. */
export async function requestStartupPermissions(): Promise<PermissionStatus> {
  if (started) return lastStatus;
  started = true;
  // Location first, then camera — sequential so the two prompts don't collide.
  const location = await ensureLocation();
  const camera = await ensureCamera();
  lastStatus = { camera, location };
  return lastStatus;
}

/** Re-request the permissions on demand (e.g. from a "grant" button). Bypasses
 *  the once-per-load guard. On web a permanently-denied permission won't re-
 *  prompt — the caller should then point the user to site settings. */
export async function promptPermissions(): Promise<PermissionStatus> {
  started = true;
  const location = await ensureLocation();
  const camera = await ensureCamera();
  lastStatus = { camera, location };
  return lastStatus;
}

/** Re-check the CURRENT permission state WITHOUT prompting (e.g. after the user
 *  returns from browser settings). Falls back to the last known status. */
export async function recheckPermissions(): Promise<PermissionStatus> {
  try {
    if (isNative) {
      const cam = await Camera.checkPermissions();
      const loc = await Geolocation.checkPermissions();
      lastStatus = {
        camera: cam.camera === 'granted',
        location: loc.location === 'granted' || loc.coarseLocation === 'granted',
      };
      return lastStatus;
    }
    let { camera, location } = lastStatus;
    // Permissions API isn't universal (esp. 'camera') — probe defensively.
    const perms = (navigator as unknown as { permissions?: Permissions }).permissions;
    if (perms?.query) {
      try {
        camera = (await perms.query({ name: 'camera' as PermissionName })).state === 'granted';
      } catch {
        /* not queryable — keep last */
      }
      try {
        location = (await perms.query({ name: 'geolocation' })).state === 'granted';
      } catch {
        /* keep last */
      }
    }
    lastStatus = { camera, location };
    return lastStatus;
  } catch {
    return lastStatus;
  }
}
