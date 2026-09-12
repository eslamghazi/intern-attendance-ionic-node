import { describe, it, expect } from 'vitest';
import { EMBEDDING_DIM, cosineSimilarity, isEmbedding } from './similarity.js';

/** A 512-long vector, `fill` everywhere unless `overrides` says otherwise. */
function vec(fill: number, overrides: Record<number, number> = {}): number[] {
  const v = new Array<number>(EMBEDDING_DIM).fill(fill);
  for (const [i, n] of Object.entries(overrides)) v[Number(i)] = n;
  return v;
}

describe('isEmbedding', () => {
  it('accepts exactly 512 finite numbers', () => {
    expect(isEmbedding(vec(0.1))).toBe(true);
  });

  it('rejects the wrong length in both directions', () => {
    expect(isEmbedding(new Array(511).fill(0.1))).toBe(false);
    expect(isEmbedding(new Array(513).fill(0.1))).toBe(false);
  });

  it('rejects NaN and Infinity, which JSON.parse cannot produce but a client can', () => {
    expect(isEmbedding(vec(0.1, { 7: NaN }))).toBe(false);
    expect(isEmbedding(vec(0.1, { 7: Infinity }))).toBe(false);
  });

  it('rejects strings, null and objects', () => {
    expect(isEmbedding('[0.1, 0.2]')).toBe(false);
    expect(isEmbedding(null)).toBe(false);
    expect(isEmbedding({ length: EMBEDDING_DIM })).toBe(false);
    expect(isEmbedding(vec(0.1).map(String))).toBe(false);
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for a vector against itself', () => {
    const v = vec(0, { 0: 3, 1: 4 });
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 12);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity(vec(0, { 0: 1 }), vec(0, { 1: 1 }))).toBeCloseTo(0, 12);
  });

  it('is -1 for opposite vectors', () => {
    expect(cosineSimilarity(vec(0, { 0: 1 }), vec(0, { 0: -1 }))).toBeCloseTo(-1, 12);
  });

  it('ignores magnitude — the whole point of cosine', () => {
    const a = vec(0, { 0: 1, 1: 2 });
    const scaled = vec(0, { 0: 100, 1: 200 });
    expect(cosineSimilarity(a, scaled)).toBeCloseTo(1, 12);
  });

  it('matches the hand-computed value on a known pair', () => {
    // a·b = 1*4 + 2*5 + 3*6 = 32; |a| = sqrt(14); |b| = sqrt(77)
    const a = vec(0, { 0: 1, 1: 2, 2: 3 });
    const b = vec(0, { 0: 4, 1: 5, 2: 6 });
    expect(cosineSimilarity(a, b)).toBeCloseTo(32 / (Math.sqrt(14) * Math.sqrt(77)), 12);
  });

  it('equals the dot product when both are unit vectors — what the client sends', () => {
    const unit = (raw: number[]) => {
      const n = Math.hypot(...raw);
      return raw.map((x) => x / n);
    };
    const a = unit(vec(0, { 0: 0.3, 1: -0.9, 2: 0.4 }));
    const b = unit(vec(0, { 0: 0.5, 1: -0.7, 2: 0.1 }));
    const dot = a.reduce((s, x, i) => s + x * b[i]!, 0);
    expect(cosineSimilarity(a, b)).toBeCloseTo(dot, 12);
  });

  it('never exceeds 1, even where floating point would', () => {
    const v = vec(0.0439453125); // exact in binary, so the sum is reproducible
    const score = cosineSimilarity(v, v)!;
    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBeCloseTo(1, 12);
  });

  it('returns null rather than NaN for a zero vector', () => {
    expect(cosineSimilarity(vec(0), vec(1))).toBeNull();
    expect(cosineSimilarity(vec(1), vec(0))).toBeNull();
    expect(cosineSimilarity(vec(0), vec(0))).toBeNull();
  });

  it('returns null on a length mismatch instead of comparing a prefix', () => {
    expect(cosineSimilarity(vec(1), new Array(256).fill(1))).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(cosineSimilarity([], [])).toBeNull();
  });

  it('returns null when a value is not finite', () => {
    expect(cosineSimilarity(vec(1, { 3: Infinity }), vec(1))).toBeNull();
  });

  it('is symmetric', () => {
    const a = vec(0, { 0: 1, 5: -2, 9: 0.5 });
    const b = vec(0, { 0: 0.2, 5: 3, 9: -1 });
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a)!, 12);
  });
});
