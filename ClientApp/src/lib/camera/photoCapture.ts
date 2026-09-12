// Custom full-screen photo camera (getUserMedia) with a live face detector and
// an animated overlay. Capture-only (no gallery/upload), front/back flip. The
// frame is rendered onto a canvas so the overlay lines up exactly with the feed.
// On capture it crops to the detected face (falling back to a center crop) which
// makes face matching far more reliable. Pure-web + WASM => works on every
// browser/WebView, iOS & Android, and degrades to a static guide if the detector
// can't load. All photo-camera behaviour lives here (one place to edit).
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { getFaceLandmarker, detectFace, type FaceBox } from './faceDetect';
import { createTurnChallenge, type TurnLabels } from './turnChallenge';
import { LIVENESS, CAPTURE } from '../config';

export interface PhotoResult {
  webPath: string;
  blob: Blob;
}

export interface CameraLabels {
  /** shown while no face / face not centered */
  guide?: string;
  /** liveness challenge instructions (a random one is picked per session) */
  liveness?: Partial<Record<'blink' | 'smile' | 'mouthOpen' | 'browUp', string>>;
  /** head-turn (3D) challenge prompts */
  turn?: TurnLabels;
  /** Why the camera is not locking on yet, so the user can fix it instead of
   *  staring at a frame that never turns green. */
  tips?: Partial<Record<'loading' | 'closer' | 'center' | 'dark' | 'manyFaces', string>>;
}

/** Which liveness proof the admin asked for (app_settings.liveness_mode).
 *  'action' = an expression challenge, 'turn' = the head-turn depth check,
 *  'both' = the turn first, then an expression. */
export type LivenessMode = 'action' | 'turn' | 'both';

const CLOSE_SVG =
  '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const FLIP_SVG =
  '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 8a8 8 0 0 0-14-2M4 6v4h4"/><path d="M4 16a8 8 0 0 0 14 2M20 18v-4h-4"/></svg>';

const OUT_SIZE = CAPTURE.OUT_SIZE;
const GREEN = CAPTURE.GUIDE_COLOR;

export async function capturePhoto(
  opts: {
    facing?: 'user' | 'environment';
    labels?: CameraLabels;
    requireLiveness?: boolean;
    livenessMode?: LivenessMode;
    holdMs?: number;
  } = {},
): Promise<PhotoResult | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;

  if (Capacitor.isNativePlatform()) {
    try {
      await Camera.requestPermissions({ permissions: ['camera'] });
    } catch {
      /* best-effort */
    }
  }

  // Kick off the detector load in parallel with the camera (both are async).
  const detectorReady = getFaceLandmarker();
  const labels = opts.labels ?? {};

  let facing: 'user' | 'environment' = opts.facing ?? 'user';
  let stream: MediaStream | null = null;

  const overlay = document.createElement('div');
  overlay.className = 'cam-overlay';

  const video = document.createElement('video');
  video.className = 'cam-video';
  video.setAttribute('playsinline', 'true');
  video.muted = true;
  video.autoplay = true;

  const canvas = document.createElement('canvas');
  canvas.className = 'cam-canvas';
  const ctx = canvas.getContext('2d');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'cam-btn cam-close';
  closeBtn.innerHTML = CLOSE_SVG;

  const hint = document.createElement('div');
  hint.className = 'cam-hint';
  hint.textContent = labels.guide ?? '';

  const bar = document.createElement('div');
  bar.className = 'cam-bar';
  const spacer = document.createElement('span');
  spacer.className = 'cam-spacer';
  const flipBtn = document.createElement('button');
  flipBtn.type = 'button';
  flipBtn.className = 'cam-btn cam-flip';
  flipBtn.innerHTML = FLIP_SVG;
  // Capture is fully automatic (face held steady) in BOTH enrollment and
  // check-in — there is no manual shutter button anywhere. Only the flip
  // (front/back) control remains.
  bar.append(spacer, flipBtn);

  overlay.append(video, canvas, closeBtn, hint, bar);

  // ---- shared geometry (cover mapping video -> canvas, NO mirror) ----
  let CW = 0;
  let CH = 0;
  const sizeCanvas = () => {
    CW = overlay.clientWidth || window.innerWidth;
    CH = overlay.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(CW * dpr);
    canvas.height = Math.round(CH * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const cover = () => {
    const VW = video.videoWidth || CW;
    const VH = video.videoHeight || CH;
    const s = Math.max(CW / VW, CH / VH);
    return { VW, VH, s, ox: (CW - VW * s) / 2, oy: (CH - VH * s) / 2 };
  };

  const startStream = async () => {
    if (stream) stream.getTracks().forEach((tr) => tr.stop());
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false,
    });
    video.srcObject = stream;
    // Some browsers only start decoding after metadata is ready; wait for it,
    // then play() with one retry so the preview isn't left on a black frame.
    if (!video.videoWidth) {
      await new Promise<void>((res) => {
        const done = () => res();
        video.onloadedmetadata = done;
        setTimeout(done, 1500); // fallback — never hang
      });
    }
    try {
      await video.play();
    } catch {
      await new Promise((r) => setTimeout(r, 200));
      await video.play().catch(() => undefined);
    }
  };

  let latestBox: FaceBox | null = null; // in video pixel coords
  let latestPoints: Float64Array | null = null; // landmarks, for the turn check
  let faceCount = 0; // more than one face in shot blocks the capture
  let frame = 0;

  // Tiny offscreen canvas used to read the frame's brightness: a dark room is
  // the most common reason the detector finds nothing, and the user can only
  // fix it if we say so.
  const lumaCanvas = document.createElement('canvas');
  lumaCanvas.width = 32;
  lumaCanvas.height = 32;
  const lumaCtx = lumaCanvas.getContext('2d', { willReadFrequently: true });
  const frameBrightness = (v: HTMLVideoElement): number => {
    if (!lumaCtx || !v.videoWidth) return 1;
    try {
      lumaCtx.drawImage(v, 0, 0, 32, 32);
      const { data } = lumaCtx.getImageData(0, 0, 32, 32);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      return sum / (data.length / 4) / 255;
    } catch {
      return 1; // tainted canvas etc. — never block on the tip
    }
  };

  return new Promise<PhotoResult | null>((resolve) => {
    let done = false;
    let raf = 0;
    let detector: Awaited<ReturnType<typeof getFaceLandmarker>> = null;
    detectorReady.then((d) => (detector = d));

    const cleanup = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', sizeCanvas);
      stream?.getTracks().forEach((tr) => tr.stop());
      overlay.remove();
    };
    const finish = (result: PhotoResult | null) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(result);
    };

    // Capture the current frame, cropped to the detected face (or center).
    let capturing = false;
    const doCapture = () => {
      if (capturing) return;
      const VW = video.videoWidth;
      const VH = video.videoHeight;
      if (!VW || !VH) return;
      capturing = true;

      let sx: number;
      let sy: number;
      let side: number;
      if (latestBox) {
        const m = latestBox.width * 0.45; // margin around the face
        const cxp = latestBox.x + latestBox.width / 2;
        const cyp = latestBox.y + latestBox.height / 2;
        side = Math.min(Math.max(latestBox.width, latestBox.height) + m * 2, Math.min(VW, VH));
        sx = Math.max(0, Math.min(cxp - side / 2, VW - side));
        sy = Math.max(0, Math.min(cyp - side / 2, VH - side));
      } else {
        side = Math.min(VW, VH);
        sx = (VW - side) / 2;
        sy = (VH - side) / 2;
      }

      const out = document.createElement('canvas');
      out.width = OUT_SIZE;
      out.height = OUT_SIZE;
      const octx = out.getContext('2d');
      if (!octx) return finish(null);
      // Match the on-screen preview: un-mirror the front camera so the stored
      // crop is a normal image. Both enrollment and check-in go through here, so
      // the embedding orientation stays consistent between them.
      if (facing === 'user') {
        octx.translate(OUT_SIZE, 0);
        octx.scale(-1, 1);
      }
      octx.drawImage(video, sx, sy, side, side, 0, 0, OUT_SIZE, OUT_SIZE);
      out.toBlob(
        (blob) => {
          if (!blob) {
            capturing = false;
            return finish(null);
          }
          finish({ webPath: URL.createObjectURL(blob), blob });
        },
        'image/jpeg',
        0.92,
      );
    };

    // Liveness, then a steady hold, then auto-capture. Enrollment skips it
    // (requireLiveness=false). Two kinds of proof, picked by the admin setting:
    //   action — a random expression challenge (blink / smile / mouth / brows);
    //            beats a printed photo, but not a replayed video.
    //   turn   — turn the head and prove the face is 3D (parallax); beats a
    //            photo AND a flat screen replay.
    //   both   — the turn first, then an expression.
    const HOLD_MS = Math.max(0, Math.round((opts.holdMs ?? 2000)));
    const mode: LivenessMode = opts.livenessMode ?? 'action';
    const needTurn = !!opts.requireLiveness && (mode === 'turn' || mode === 'both');
    const needAction = !!opts.requireLiveness && (mode === 'action' || mode === 'both');
    const turn = needTurn ? createTurnChallenge(labels.turn) : null;
    let turnDone = !needTurn;
    const shapes = { blink: 0, smile: 0, mouthOpen: 0, browUp: 0 };

    type ChId = 'blink' | 'smile' | 'mouthOpen' | 'browUp';
    let sawClosedOnce = false; // for the blink challenge (eyes were closed)
    const allChallenges: { id: ChId; done: () => boolean }[] = [
      // blink = eyes closed at some point, then open again
      { id: 'blink', done: () => sawClosedOnce && shapes.blink < 0.2 },
      { id: 'smile', done: () => shapes.smile > 0.6 },
      { id: 'mouthOpen', done: () => shapes.mouthOpen > 0.5 },
      { id: 'browUp', done: () => shapes.browUp > 0.5 },
    ];
    const avail = allChallenges.filter((c) => opts.labels?.liveness?.[c.id]);
    const pool = avail.length ? avail : [allChallenges[0]];
    const challenge = pool[Math.floor(Math.random() * pool.length)];
    let challengeDone = !needAction;
    let okSince = 0;

    /** Corner brackets + sweeping scan line. Used for the idle target frame and
     *  for the box tracking a detected face, so the two read as one shape. */
    const drawFrame = (
      bx: number,
      by: number,
      bw: number,
      bh: number,
      color: string,
      locked: boolean,
    ) => {
      if (!ctx) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = locked ? 16 : 0;
      const seg = Math.min(bw, bh) * 0.26;
      const corners: [number, number, number, number][] = [
        [bx, by, 1, 1],
        [bx + bw, by, -1, 1],
        [bx, by + bh, 1, -1],
        [bx + bw, by + bh, -1, -1],
      ];
      for (const [x, y, dx, dy] of corners) {
        ctx.beginPath();
        ctx.moveTo(x + dx * seg, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + dy * seg);
        ctx.stroke();
      }
      const sweep = (Math.sin(frame / 34) + 1) / 2; // 0..1
      const ly = by + sweep * bh;
      const grad = ctx.createLinearGradient(0, ly - 16, 0, ly + 16);
      grad.addColorStop(0, 'rgba(45,211,111,0)');
      grad.addColorStop(0.5, locked ? 'rgba(45,211,111,0.6)' : 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(45,211,111,0)');
      ctx.shadowBlur = 0;
      ctx.fillStyle = grad;
      ctx.fillRect(bx, ly - 16, bw, 32);
      ctx.restore();
    };

    let everDetected = false; // first lock-on: run the detector flat out
    let dim = false; // last brightness reading said the room is too dark

    const loop = () => {
      frame++;
      if (ctx && video.videoWidth) {
        const { VW, VH, s, ox, oy } = cover();
        // Flip the front camera horizontally so the preview + capture read as a
        // normal (non-reversed) image. The device stream comes back mirrored on
        // the front camera; undo it here for the whole frame (video + tracking
        // overlay together, so the box stays aligned). Restored before drawing
        // the countdown number so that text stays readable.
        const mirror = facing === 'user';
        ctx.save();
        if (mirror) {
          ctx.translate(CW, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, VW, VH, ox, oy, VW * s, VH * s);

        // Detect on EVERY frame until the first face is found — waiting for the
        // frame to appear is the slowest-feeling part — then fall back to every
        // other frame, which is plenty for tracking and lighter on the CPU.
        const fresh = !!detector && (!everDetected || frame % 2 === 0);
        if (detector && fresh) {
          const r = detectFace(detector, video, performance.now());
          latestBox = r.box;
          latestPoints = r.points;
          faceCount = r.faces;
          shapes.blink = r.blink;
          shapes.smile = r.smile;
          shapes.mouthOpen = r.mouthOpen;
          shapes.browUp = r.browUp;
          if (r.box) everDetected = true;
        }
        // Check the lighting only while nothing is detected — that is the only
        // time the answer is actionable.
        if (!latestBox && frame % 15 === 0) dim = frameBrightness(video) < 0.22;

        // face considered "ok" when detected, reasonably centered & large. A
        // face mid-turn is narrower on screen, so the size bar drops while the
        // turn challenge is running — otherwise turning would "lose" the face
        // and restart the challenge forever.
        let faceOk = false;
        if (latestBox) {
          const fcx = (latestBox.x + latestBox.width / 2) / VW;
          const fcy = (latestBox.y + latestBox.height / 2) / VH;
          const fsize = latestBox.width / VW;
          const minSize = turn && !turnDone ? LIVENESS.turnMinFaceSize : 0.18;
          faceOk =
            faceCount === 1 &&
            fsize > minSize &&
            Math.abs(fcx - 0.5) < 0.22 &&
            Math.abs(fcy - 0.46) < 0.22;

          // tracking box on the detected face (mapped to canvas)
          // pad the raw detection a little so the square frames the whole head
          const pad = latestBox.width * 0.18;
          const bx = ox + (latestBox.x - pad) * s;
          const by = oy + (latestBox.y - pad) * s;
          const bw = (latestBox.width + pad * 2) * s;
          const bh = (latestBox.height + pad * 2) * s;
          const color = faceOk ? GREEN : 'rgba(255,255,255,0.9)';

          drawFrame(bx, by, bw, bh, color, faceOk);
        } else {
          // NO face yet: still show the target, so "put your face in the frame"
          // refers to something the user can actually see and aim at. It sits
          // exactly where a face has to land to be accepted.
          const side = Math.min(CW, CH) * 0.62;
          drawFrame(CW / 2 - side / 2, CH * 0.46 - side / 2, side, side, 'rgba(255,255,255,0.75)', false);
        }

        // Liveness challenge(s), then a 2s countdown, then auto-capture. Only
        // FRESH detections feed the turn check — re-running it on a repeated
        // frame would read as zero motion and skew its jitter baseline.
        const now = performance.now();
        if (turn && fresh) turnDone = turn.update(latestPoints, faceOk);
        if (faceOk) {
          // The expression challenge only starts once the face proved it is 3D,
          // so in 'both' mode a smile during the turn can't stand in for it.
          if (turnDone) {
            if (challenge.id === 'blink' && shapes.blink > 0.5) sawClosedOnce = true;
            if (!challengeDone && challenge.done()) challengeDone = true;
          }
        } else {
          // face lost -> restart the challenge + countdown
          sawClosedOnce = false;
          if (needAction) challengeDone = false;
          if (needTurn) turnDone = false;
        }
        // the countdown only runs once every liveness challenge is satisfied
        okSince = faceOk && turnDone && challengeDone ? okSince || now : 0;
        const elapsed = okSince ? now - okSince : 0;

        // Say WHY it is not locking on: no detector yet, too dark, no face, face
        // too far, or off to one side.
        let hintText: string;
        if (faceCount > 1) {
          hintText = labels.tips?.manyFaces ?? labels.guide ?? '';
        } else if (!latestBox) {
          if (!detector) hintText = labels.tips?.loading ?? labels.guide ?? '';
          else if (dim) hintText = labels.tips?.dark ?? labels.guide ?? '';
          else hintText = labels.guide ?? '';
        } else if (!faceOk) {
          const tooSmall = latestBox.width / VW <= (turn && !turnDone ? LIVENESS.turnMinFaceSize : 0.18);
          hintText = (tooSmall ? labels.tips?.closer : labels.tips?.center) ?? labels.guide ?? '';
        } else {
          hintText = labels.guide ?? '';
        }
        let countdownNum = 0;
        if (faceOk) {
          if (!turnDone) {
            hintText = turn?.hint() ?? '';
          } else if (!challengeDone) {
            hintText = labels.liveness?.[challenge.id] ?? '';
          } else if (elapsed < HOLD_MS) {
            countdownNum = Math.ceil((HOLD_MS - elapsed) / 1000);
            hintText = '';
          } else {
            doCapture();
          }
        }
        hint.textContent = hintText;

        // end the mirrored draw region so UI text (the countdown) stays readable
        ctx.restore();

        if (countdownNum > 0) {
          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,0.96)';
          ctx.font = `700 ${Math.round(Math.min(CW, CH) * 0.2)}px system-ui, -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.55)';
          ctx.shadowBlur = 16;
          ctx.fillText(String(countdownNum), CW / 2, CH * 0.46);
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(loop);
    };

    closeBtn.onclick = () => finish(null);
    flipBtn.onclick = async () => {
      facing = facing === 'user' ? 'environment' : 'user';
      latestBox = null;
      try {
        await startStream();
      } catch {
        /* keep current */
      }
    };

    window.addEventListener('resize', sizeCanvas);
    document.body.appendChild(overlay);
    sizeCanvas();
    startStream()
      .then(() => {
        raf = requestAnimationFrame(loop);
        // Watchdog: if the camera never delivers frames (black feed — camera busy,
        // blocked, or driver issue), don't leave the member staring at black.
        const started = performance.now();
        const check = () => {
          if (done) return;
          if (video.videoWidth && !video.paused) return; // healthy
          if (performance.now() - started > 7000) {
            finish(null); // give up so the user can retry
            return;
          }
          setTimeout(check, 500);
        };
        setTimeout(check, 2000);
      })
      .catch(() => finish(null));
  });
}
