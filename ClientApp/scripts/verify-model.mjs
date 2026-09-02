// Inspect the face model: print input/output names + dims, and the embedding
// length produced for a 112x112x3 input. Run: node scripts/verify-model.mjs
import * as ort from 'onnxruntime-node';

const PATH = 'public/models/mobilefacenet.onnx';
const session = await ort.InferenceSession.create(PATH);
console.log('inputNames :', session.inputNames);
console.log('outputNames:', session.outputNames);

const size = 112;
const data = new Float32Array(1 * 3 * size * size); // zeros
const tensor = new ort.Tensor('float32', data, [1, 3, size, size]);
try {
  const res = await session.run({ [session.inputNames[0]]: tensor });
  const out = res[session.outputNames[0]];
  console.log('output dims :', JSON.stringify(out.dims));
  console.log('embedding length:', out.data.length);
} catch (e) {
  console.error('Run with [1,3,112,112] failed -> model expects a different input.');
  console.error(String(e.message ?? e));
}
