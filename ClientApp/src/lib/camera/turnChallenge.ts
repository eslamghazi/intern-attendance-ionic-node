// Head-turn liveness challenge: "turn your face, then look back at me".
//
// The turn itself proves nothing — a video replay turns its head too. What the
// turn buys us is PARALLAX: while the head rotates we compare the landmarks
// against the frontal reference and measure the motion no flat surface could
// produce (see parallax.ts). A photo or a phone screen is a plane, so its whole
// motion is explained away and it scores at noise level.
//
// The threshold is not fixed to a magic number: the challenge first watches the
// user hold still, facing forward, to learn how much the landmarks jitter on
// THIS device in THIS light, then requires the turn to beat that baseline by a
// wide margin. So a noisy camera makes the test stricter, never looser.
import { LIVENESS } from '../config';
import { faceAspect, median, parallaxScore, turnDegrees } from './parallax';

export interface TurnLabels {
  /** while learning the baseline — "hold still, look at the camera" */
  hold?: string;
  /** the actual challenge — "turn your head slowly" */
  turn?: string;
  /** after it passed — "look back at the camera" */
  back?: string;
  /** turned far enough, but it looked flat — "turn a bit further / more light" */
  failed?: string;
}

export type TurnStage = 'frontal' | 'turn' | 'back' | 'done';

export interface TurnChallenge {
  /** Current step, so the camera can relax its framing rules mid-turn. */
  readonly stage: TurnStage;
  /** Prompt to show for the current step. */
  hint: () => string;
  /** Feed ONE freshly detected frame. True once the face has proven itself 3D
   *  AND come back to frontal (i.e. it is safe to take the photo). */
  update: (points: Float64Array | null, faceOk: boolean) => boolean;
  reset: () => void;
}

export function createTurnChallenge(labels: TurnLabels = {}): TurnChallenge {
  let stage: TurnStage = 'frontal';
  let frontalAspect = 0; // widest (= most frontal) aspect seen so far
  let refPoints: Float64Array | null = null; // frontal reference for the fit
  let prevFrontal: Float64Array | null = null;
  let noise: number[] = []; // frontal-vs-frontal residuals = landmark jitter
  let turns: number[] = []; // reference-vs-turned residuals = parallax
  let retried = false; // they turned, it looked flat — ask once more, louder

  const reset = () => {
    stage = 'frontal';
    frontalAspect = 0;
    refPoints = null;
    prevFrontal = null;
    noise = [];
    turns = [];
  };

  /** Real 3D motion has to clear BOTH bars: an absolute floor, and a wide
   *  margin over this device's own jitter. */
  const proven = () =>
    turns.length >= LIVENESS.turnSamples &&
    median(turns) >= Math.max(LIVENESS.parallaxFloor, LIVENESS.parallaxRatio * median(noise));

  const update = (points: Float64Array | null, faceOk: boolean): boolean => {
    // Face lost or out of frame: start over — even from 'done'. The proof must
    // cover ONE continuous face, so a passed turn can never be handed over to
    // whoever steps in front of the camera next.
    if (!faceOk || !points) {
      reset();
      return false;
    }
    if (stage === 'done') return true;
    const aspect = faceAspect(points);
    if (!aspect) return false;
    if (aspect > frontalAspect) frontalAspect = aspect; // most-frontal frame wins
    const deg = turnDegrees(frontalAspect, aspect);

    switch (stage) {
      case 'frontal':
        // Learn the jitter baseline from consecutive still, frontal frames.
        if (deg > LIVENESS.frontalDeg) {
          prevFrontal = null; // they moved off-centre; don't pair across the gap
          return false;
        }
        if (prevFrontal) noise.push(parallaxScore(prevFrontal, points));
        prevFrontal = points;
        refPoints = points;
        if (noise.length >= LIVENESS.noiseSamples) stage = 'turn';
        return false;

      case 'turn':
        if (deg >= LIVENESS.turnDeg && refPoints) {
          turns.push(parallaxScore(refPoints, points));
          if (proven()) stage = 'back';
          else if (turns.length >= LIVENESS.turnRetrySamples) {
            // Turned far enough repeatedly and it still reads as a flat surface.
            turns = [];
            retried = true;
          }
        }
        return false;

      case 'back':
        if (deg <= LIVENESS.frontalDeg) stage = 'done';
        return stage === 'done';
    }
  };

  return {
    get stage() {
      return stage;
    },
    hint: () => {
      if (stage === 'frontal') return labels.hold ?? '';
      if (stage === 'turn') return (retried ? labels.failed : labels.turn) ?? labels.turn ?? '';
      if (stage === 'back') return labels.back ?? '';
      return '';
    },
    update,
    reset,
  };
}
