// Reusable "prove it's really you" face check — captures a live face (with the
// same liveness challenge as check-in) and matches it against the member's
// enrolled embedding. Used by presence-confirmation so a member can't have a
// colleague tap "I'm here" for them.
import type { TFunction } from 'i18next';
import { captureFace } from './camera';
import { getFaceAttrs, isSingleFrontalFace } from './liveness';
import { getEnrolledEmbedding } from './template';
import { bestSimilarity } from './face';
import { getSettings } from '../api/settings';
import { FACE } from '../config';

export type FaceVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'liveness' | 'not_enrolled' | 'face_mismatch' | 'error' };

/** Capture + match the member's face (mirrors CheckInPage's face gate). */
export async function verifyMemberFace(memberId: string, t: TFunction): Promise<FaceVerifyResult> {
  const settings = await getSettings().catch(() => null);
  const threshold = settings?.face_match_threshold ?? FACE.defaultMatchThreshold;
  const livenessRequired = settings?.liveness_required ?? true;
  const livenessMode = settings?.liveness_mode ?? 'turn';
  const holdMs = (settings?.capture_hold_seconds ?? 3) * 1000;

  let cap;
  try {
    cap = await captureFace(
      {
        guide: t('camera.faceGuide'),
        liveness: {
          blink: t('camera.chBlink'),
          smile: t('camera.chSmile'),
          mouthOpen: t('camera.chMouth'),
          browUp: t('camera.chBrow'),
        },
        turn: {
          hold: t('camera.chTurnHold'),
          turn: t('camera.chTurn'),
          back: t('camera.chTurnBack'),
          failed: t('camera.chTurnFailed'),
        },
      },
      livenessRequired,
      holdMs,
      livenessMode,
    );
  } catch {
    return { ok: false, reason: 'error' };
  }
  if (!cap) return { ok: false, reason: 'cancelled' };

  const attrs = await getFaceAttrs(cap.path);
  if (!isSingleFrontalFace(attrs)) return { ok: false, reason: 'liveness' };

  try {
    const enrolled = await getEnrolledEmbedding(memberId);
    if (!enrolled) return { ok: false, reason: 'not_enrolled' };
    const score = (await bestSimilarity(cap.webPath, enrolled)).score;
    if (score < threshold) return { ok: false, reason: 'face_mismatch' };
  } catch {
    return { ok: false, reason: 'error' };
  }
  return { ok: true };
}
