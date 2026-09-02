// Central QR-camera engine. ALL QR scanning goes through here so camera quirks
// are fixed in one place. Wraps html5-qrcode (getUserMedia) with the robustness
// that a bare start() lacks — the things that otherwise show a BLACK camera:
//   1. native OS camera permission is requested first (Capacitor),
//   2. a real back camera is chosen by device id (facingMode alone fails on
//      many phones and yields a black/placeholder feed),
//   3. graceful fallback: back-id -> environment -> user (front),
//   4. secure-context / API guard with a clear error instead of a silent black.
// The caller owns the container element + its sizing (see QrScanner.tsx).
import { Html5Qrcode } from 'html5-qrcode';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

interface CameraDevice {
  id: string;
  label: string;
}

export type QrScanErrorReason = 'camera_unavailable' | 'camera_start_failed';

export interface StartQrScanOptions {
  elementId: string;
  onScan: (text: string) => void;
  onError?: (reason: QrScanErrorReason) => void;
}

export interface QrScanHandle {
  stop: () => Promise<void>;
}

/** Choose the rear camera: match its label, else fall back to the last device
 *  (phones typically list the back camera last). */
function pickBackCamera(cameras: CameraDevice[]): string | null {
  if (!cameras.length) return null;
  const back = cameras.find((c) => /back|rear|environment|خلف/i.test(c.label || ''));
  return (back ?? cameras[cameras.length - 1]).id;
}

const SCAN_CONFIG = {
  fps: 10,
  qrbox: (viewW: number, viewH: number) => {
    const min = Math.min(viewW, viewH);
    const size = Math.max(160, Math.floor(min * 0.7));
    return { width: size, height: size };
  },
  aspectRatio: 1,
};

export async function startQrScan(opts: StartQrScanOptions): Promise<QrScanHandle> {
  const { elementId, onScan, onError } = opts;

  // Secure-context / API guard: getUserMedia needs https, localhost, or a native
  // webview. Without it the feed is just black — surface an error instead.
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    onError?.('camera_unavailable');
    return { stop: async () => {} };
  }

  // On a device, make sure the OS-level camera permission is granted before the
  // webview asks for the stream (a missing grant is a common black-camera cause).
  if (Capacitor.isNativePlatform()) {
    try {
      await Camera.requestPermissions({ permissions: ['camera'] });
    } catch {
      /* best-effort; the getUserMedia attempt below still surfaces failures */
    }
  }

  const scanner = new Html5Qrcode(elementId, false);
  let stopped = false;

  const stop = async () => {
    stopped = true;
    try {
      await scanner.stop();
    } catch {
      /* was not running */
    }
    try {
      scanner.clear();
    } catch {
      /* ignore */
    }
  };

  const onDecoded = (decoded: string) => {
    if (stopped) return;
    stopped = true;
    void stop();
    onScan(decoded);
  };

  // Try, in order: explicit back-camera id, then environment, then user (front).
  const attempts: Array<() => Promise<unknown>> = [];
  try {
    const cameras = (await Html5Qrcode.getCameras()) as CameraDevice[];
    const backId = pickBackCamera(cameras);
    if (backId) attempts.push(() => scanner.start(backId, SCAN_CONFIG, onDecoded, () => undefined));
  } catch {
    /* getCameras can reject if permission is denied — fall through to facingMode */
  }
  attempts.push(() => scanner.start({ facingMode: 'environment' }, SCAN_CONFIG, onDecoded, () => undefined));
  attempts.push(() => scanner.start({ facingMode: 'user' }, SCAN_CONFIG, onDecoded, () => undefined));

  let started = false;
  for (const attempt of attempts) {
    if (stopped) break;
    try {
      await attempt();
      started = true;
      break;
    } catch {
      /* try the next camera constraint */
    }
  }
  if (!started && !stopped) onError?.('camera_start_failed');

  // Mirror the preview ONLY for a front/user camera (natural selfie view); the
  // rear camera must stay un-mirrored so it matches reality. Decoding reads the
  // raw stream, so this CSS flip never affects scanning.
  if (started) {
    try {
      const videoEl = document.querySelector<HTMLVideoElement>(`#${elementId} video`);
      const track = (videoEl?.srcObject as MediaStream | null)?.getVideoTracks?.()[0];
      const facing = track?.getSettings?.().facingMode;
      const isRear = facing === 'environment';
      document.getElementById(elementId)?.classList.toggle('qr-mirror', !isRear);
    } catch {
      /* ignore — no mirror class applied */
    }
  }

  return { stop };
}

/**
 * Decode a QR out of a still IMAGE the user picked from their gallery/files —
 * the fallback for when the live camera can't get a clean read (glare, a code
 * on a screen, a photo someone sent them).
 *
 * Runs on its own throwaway element so it never disturbs a running camera scan.
 * Returns null when the image holds no readable QR.
 */
export async function scanQrFile(file: File): Promise<string | null> {
  const host = document.createElement('div');
  host.id = `qr-file-${Date.now()}`;
  // Off-screen but still laid out — html5-qrcode needs a real element.
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:320px;height:320px;';
  document.body.appendChild(host);
  const scanner = new Html5Qrcode(host.id, false);
  try {
    return await scanner.scanFile(file, false);
  } catch {
    return null; // no QR in the image (or an unsupported/corrupt file)
  } finally {
    try {
      scanner.clear();
    } catch {
      /* nothing to clear */
    }
    host.remove();
  }
}
