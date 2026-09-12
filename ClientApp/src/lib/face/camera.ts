import {
  Camera,
  CameraDirection,
  CameraResultType,
  CameraSource,
} from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { capturePhoto, type CameraLabels, type LivenessMode } from '../camera/photoCapture';

export interface Capture {
  /** Native file path (for ML Kit processImage). Empty on web. */
  path: string;
  /** Web-displayable URL (for drawing to canvas / preview). */
  webPath: string;
}

/**
 * Capture a single front-camera photo for liveness + embedding.
 *
 * ALWAYS prefers our own in-app camera — on the phone as much as in a browser.
 * The OS camera hands back a still photo and nothing else, and no live frames
 * means no liveness challenge at all — the head-turn and expression checks
 * cannot run, and a printed photo held up to the lens passes. getUserMedia works
 * inside the Capacitor WebView, so there is no reason to give that up.
 *
 * The OS camera stays as a fallback for a WebView with no getUserMedia; that
 * path still yields a file path ML Kit can screen for a single frontal face.
 *
 * Returns null if the user cancels.
 */
export async function captureFace(
  labels?: CameraLabels,
  requireLiveness = false,
  holdMs?: number,
  livenessMode?: LivenessMode,
): Promise<Capture | null> {
  const canStream =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  if (!canStream) {
    if (!Capacitor.isNativePlatform()) return null;
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      direction: CameraDirection.Front,
      correctOrientation: true,
      saveToGallery: false,
      width: 720,
    });
    return { path: photo.path ?? '', webPath: photo.webPath ?? '' };
  }

  const res = await capturePhoto({ facing: 'user', labels, requireLiveness, holdMs, livenessMode });
  if (!res) return null;
  return { path: '', webPath: res.webPath };
}
