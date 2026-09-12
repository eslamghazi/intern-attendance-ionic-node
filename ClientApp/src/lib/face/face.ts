// On-device face embedding using ONNX Runtime Web + MobileFaceNet.
// Drop a 112x112 ArcFace/MobileFaceNet model at: public/models/mobilefacenet.onnx
// (output dimension must be 512 to match the stored template).
import * as ort from 'onnxruntime-web';
import { FACE, STORAGE_KEYS } from '../config';

const MODEL_URL = FACE.modelUrl;
const INPUT_SIZE = FACE.inputSize;
export const EMBEDDING_DIM = FACE.embeddingDim;

// Serve the wasm runtime from a CDN (swap to a bundled path for full offline).
ort.env.wasm.wasmPaths = FACE.wasmPaths;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

const MODEL_CACHE = STORAGE_KEYS.FACE_MODEL_CACHE;

/**
 * Return the model bytes, downloading it ONCE and persisting it in the browser's
 * Cache Storage (part of the site's data) so later visits/reloads reuse it
 * instead of re-downloading. Falls back to letting ORT fetch the URL directly
 * if the Cache API isn't available (e.g. insecure context).
 */
async function loadModelData(): Promise<Uint8Array | string> {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(MODEL_CACHE);
      let res = await cache.match(MODEL_URL);
      if (!res) {
        const net = await fetch(MODEL_URL);
        if (!net.ok) throw new Error(`model fetch ${net.status}`);
        await cache.put(MODEL_URL, net.clone()); // save once for next time
        res = net;
      }
      return new Uint8Array(await res.arrayBuffer());
    }
  } catch (e) {
    console.warn('face model cache unavailable, fetching directly:', e);
  }
  return MODEL_URL;
}

function loadSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = loadModelData()
      .then((model) =>
        typeof model === 'string'
          ? ort.InferenceSession.create(model, { executionProviders: ['wasm'] })
          : ort.InferenceSession.create(model, { executionProviders: ['wasm'] }),
      )
      .catch(() => {
        sessionPromise = null;
        throw new Error('model_unavailable');
      });
  }
  return sessionPromise;
}

/** Returns true if the ONNX model can be loaded. */
export async function isModelReady(): Promise<boolean> {
  try {
    await loadSession();
    return true;
  } catch {
    return false;
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = url;
  });
}

function preprocess(img: HTMLImageElement, flip = false): ort.Tensor {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d')!;
  // Center-crop to a square BEFORE scaling so the face isn't stretched (a
  // portrait frame squished to 112x112 distorts the face and wrecks matching).
  // Cropping the center square is aspect-independent, so enrollment and check-in
  // frames normalize to the same geometry.
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  // Optionally mirror the crop — used to match regardless of whether enrollment
  // and check-in ended up in opposite left/right orientations (front camera).
  if (flip) {
    ctx.translate(INPUT_SIZE, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, sx, sy, side, side, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  const plane = INPUT_SIZE * INPUT_SIZE;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    out[i] = (r - 127.5) / 128; // R plane
    out[plane + i] = (g - 127.5) / 128; // G plane
    out[2 * plane + i] = (b - 127.5) / 128; // B plane
  }
  return new ort.Tensor('float32', out, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

function l2normalize(v: Float32Array): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return Array.from(v, (x) => x / norm);
}

/** Compute a normalized face embedding from an image URL (Camera webPath). */
export async function getEmbedding(imageUrl: string, flip = false): Promise<number[]> {
  const session = await loadSession();
  const img = await loadImage(imageUrl);
  const input = preprocess(img, flip);
  const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]]: input };
  const results = await session.run(feeds);
  const output = results[session.outputNames[0]].data as Float32Array;
  return l2normalize(output);
}

/**
 * Best cosine similarity of a captured face against an enrolled embedding,
 * trying BOTH the face and its mirror image and keeping the higher score. This
 * makes matching robust to front-camera mirroring: a check-in still matches even
 * if the enrollment photo and the check-in photo ended up in opposite left/right
 * orientations. Returns the score and the embedding that produced it.
 */
export async function bestSimilarity(
  imageUrl: string,
  enrolled: number[],
): Promise<{ score: number; embedding: number[] }> {
  const [normal, mirrored] = await Promise.all([
    getEmbedding(imageUrl, false),
    getEmbedding(imageUrl, true),
  ]);
  const sNormal = cosineSimilarity(normal, enrolled);
  const sMirror = cosineSimilarity(mirrored, enrolled);
  return sMirror > sNormal
    ? { score: sMirror, embedding: mirrored }
    : { score: sNormal, embedding: normal };
}

/** Cosine similarity of two L2-normalized embeddings (== dot product). */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}
