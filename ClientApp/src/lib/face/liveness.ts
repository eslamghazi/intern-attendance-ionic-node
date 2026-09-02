// Active liveness via Google ML Kit face detection (native only).
// On web the SDK is unavailable, so checks return "available: false" and the
// UI treats them as a development bypass.
import { Capacitor } from '@capacitor/core';
import {
  ClassificationMode,
  FaceDetection,
  LandmarkMode,
  PerformanceMode,
} from '@capacitor-mlkit/face-detection';
import { LIVENESS } from '../config';

const isNative = Capacitor.isNativePlatform();

export type LivenessChallenge = 'blink' | 'smile' | 'turnHead';

export const CHALLENGE_LABEL_KEY: Record<LivenessChallenge, string> = {
  blink: 'checkin.livenessBlink',
  smile: 'checkin.livenessSmile',
  turnHead: 'checkin.livenessTurnRight',
};

export interface FaceAttrs {
  available: boolean;
  count: number;
  leftEye: number;
  rightEye: number;
  headY: number;
  smile: number;
}

const WEB_FALLBACK: FaceAttrs = {
  available: false,
  count: 1,
  leftEye: 1,
  rightEye: 1,
  headY: 0,
  smile: 0,
};

export function pickChallenge(): LivenessChallenge {
  const all: LivenessChallenge[] = ['blink', 'smile', 'turnHead'];
  return all[Math.floor(Math.random() * all.length)];
}

export async function getFaceAttrs(path: string): Promise<FaceAttrs> {
  if (!isNative || !path) return WEB_FALLBACK;
  try {
    const { faces } = await FaceDetection.processImage({
      path,
      performanceMode: PerformanceMode.Accurate,
      classificationMode: ClassificationMode.All,
      landmarkMode: LandmarkMode.None,
    });
    const f = faces[0];
    return {
      available: true,
      count: faces.length,
      leftEye: f?.leftEyeOpenProbability ?? 1,
      rightEye: f?.rightEyeOpenProbability ?? 1,
      headY: f?.headEulerAngleY ?? 0,
      smile: f?.smilingProbability ?? 0,
    };
  } catch {
    return WEB_FALLBACK;
  }
}

/** A single, eyes-open, roughly frontal face (used for the enrollment / probe shot). */
export function isSingleFrontalFace(a: FaceAttrs): boolean {
  if (!a.available) return true;
  return (
    a.count === 1 &&
    Math.abs(a.headY) < LIVENESS.headTurnDeg &&
    a.leftEye > 0.5 &&
    a.rightEye > 0.5
  );
}

export function passesChallenge(a: FaceAttrs, c: LivenessChallenge): boolean {
  if (!a.available) return true;
  if (a.count !== 1) return false;
  switch (c) {
    case 'blink':
      return a.leftEye < LIVENESS.eyeClosed && a.rightEye < LIVENESS.eyeClosed;
    case 'smile':
      return a.smile > LIVENESS.smileActive;
    case 'turnHead':
      return Math.abs(a.headY) > LIVENESS.headTurnDeg;
    default:
      return false;
  }
}

/**
 * The neutral ("before") frame must be in the resting state for the challenge.
 * Requiring rest -> action proves a live transition — a held-up printed photo
 * can't be both neutral first AND then perform the action.
 */
export function isRestState(a: FaceAttrs, c: LivenessChallenge): boolean {
  if (!a.available) return true;
  switch (c) {
    case 'blink':
      return a.leftEye > LIVENESS.eyeOpen && a.rightEye > LIVENESS.eyeOpen;
    case 'smile':
      return a.smile < LIVENESS.smileRest;
    case 'turnHead':
      return Math.abs(a.headY) < LIVENESS.headFrontalDeg;
    default:
      return true;
  }
}
