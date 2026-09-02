// Cross-platform face detector + liveness signal (MediaPipe FaceLandmarker, pure
// WASM). Works in any modern browser / WebView on iOS + Android with no native
// plugin; model + WASM are served from the app origin (public/) so it works
// offline. Returns the face box AND a blink score (from blendshapes) used to
// verify a real, 3D person — a printed/on-screen photo can't blink. Degrades
// gracefully: if it can't load, the camera falls back to a center crop.
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { FACE } from '../config';

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceResult {
  box: FaceBox | null;
  /** Blendshape scores (0..1) used for liveness challenges. */
  blink: number; // eyes closing
  smile: number;
  mouthOpen: number;
  browUp: number;
  /** Landmark positions in video pixels, flat [x0,y0,x1,y1,...]. Feeds the
   *  head-turn (3D) liveness check — see camera/parallax.ts. */
  points: Float64Array | null;
  /** How many faces are in frame. More than one and the capture is blocked —
   *  a second person in shot is how a stand-in gets photographed. */
  faces: number;
}

const NO_FACE: FaceResult = {
  box: null,
  blink: 0,
  smile: 0,
  mouthOpen: 0,
  browUp: 0,
  points: null,
  faces: 0,
};

let landmarkerPromise: Promise<FaceLandmarker | null> | null = null;

async function create(delegate: 'GPU' | 'CPU'): Promise<FaceLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(FACE.mediapipeWasm);
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: FACE.landmarkerModel, delegate },
    runningMode: 'VIDEO',
    // TWO, not one: we do not want a second face — we want to KNOW there is a
    // second face, so the capture can refuse. Asking for one would silently
    // return the first and hide the problem.
    numFaces: 2,
    outputFaceBlendshapes: true, // gives eyeBlinkLeft/Right for liveness
    // Below the 0.5 defaults: the frame should appear as soon as there is a
    // face to draw it on, even in poor light or at an angle. Nothing is trusted
    // because of this — liveness and the face match still decide the capture.
    minFaceDetectionConfidence: 0.3,
    minFacePresenceConfidence: 0.3,
    minTrackingConfidence: 0.3,
  });
}

async function load(): Promise<FaceLandmarker | null> {
  try {
    return await create('GPU');
  } catch {
    try {
      return await create('CPU');
    } catch {
      return null;
    }
  }
}

export function getFaceLandmarker(): Promise<FaceLandmarker | null> {
  if (!landmarkerPromise) landmarkerPromise = load();
  return landmarkerPromise;
}

/** Detect the face + blink score in a video frame. Box is in the video's native
 *  pixel coords. `ts` must be monotonically increasing. */
export function detectFace(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
  ts: number,
): FaceResult {
  const VW = video.videoWidth;
  const VH = video.videoHeight;
  if (!VW) return NO_FACE;
  try {
    const res = landmarker.detectForVideo(video, ts);
    const lm = res.faceLandmarks?.[0];
    if (!lm || lm.length === 0) return NO_FACE;

    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;
    const points = new Float64Array(lm.length * 2);
    for (let i = 0; i < lm.length; i++) {
      const p = lm[i];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      points[i * 2] = p.x * VW;
      points[i * 2 + 1] = p.y * VH;
    }
    const box: FaceBox = {
      x: minX * VW,
      y: minY * VH,
      width: (maxX - minX) * VW,
      height: (maxY - minY) * VH,
    };

    let blink = 0;
    let smile = 0;
    let mouthOpen = 0;
    let browUp = 0;
    const shapes = res.faceBlendshapes?.[0]?.categories;
    if (shapes) {
      for (const c of shapes) {
        const n = c.categoryName;
        if ((n === 'eyeBlinkLeft' || n === 'eyeBlinkRight') && c.score > blink) blink = c.score;
        else if ((n === 'mouthSmileLeft' || n === 'mouthSmileRight') && c.score > smile) smile = c.score;
        else if (n === 'jawOpen' && c.score > mouthOpen) mouthOpen = c.score;
        else if (
          (n === 'browInnerUp' || n === 'browOuterUpLeft' || n === 'browOuterUpRight') &&
          c.score > browUp
        )
          browUp = c.score;
      }
    }
    return { box, blink, smile, mouthOpen, browUp, points, faces: res.faceLandmarks.length };
  } catch {
    return NO_FACE;
  }
}
