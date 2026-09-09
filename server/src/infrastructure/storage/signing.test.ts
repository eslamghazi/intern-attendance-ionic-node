// Signed image URLs. This is the only hand-written cryptography in the project,
// so it is also the most thoroughly tested.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { env } from '../../env.js';
import { sign, signedPath, verify } from './signing.js';

const BUCKET = 'faces';
const PATH = '2026/2026010107.jpg';

afterEach(() => vi.useRealTimers());

describe('sign / verify', () => {
  it('accepts a token it just issued', () => {
    const { expires, signature } = sign(BUCKET, PATH, 60);
    expect(verify(BUCKET, PATH, expires, signature)).toBe('ok');
  });

  it('refuses a token issued for a DIFFERENT path', () => {
    // The signature covers the path; without that, one token would open every
    // file in the bucket.
    const { expires, signature } = sign(BUCKET, PATH, 60);
    expect(verify(BUCKET, '2026/2026010108.jpg', expires, signature)).toBe('invalid');
  });

  it('refuses a token issued for a different bucket', () => {
    const { expires, signature } = sign(BUCKET, PATH, 60);
    expect(verify('probes', PATH, expires, signature)).toBe('invalid');
  });

  it('refuses a token whose expiry was edited to extend it', () => {
    const { expires, signature } = sign(BUCKET, PATH, 60);
    expect(verify(BUCKET, PATH, expires + 86_400, signature)).toBe('invalid');
  });

  it('reports a genuinely expired token as expired, not invalid', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T09:00:00Z'));
    const { expires, signature } = sign(BUCKET, PATH, 60);
    vi.setSystemTime(new Date('2026-08-29T09:01:01Z'));
    expect(verify(BUCKET, PATH, expires, signature)).toBe('expired');
  });

  it('is still valid one second before it expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T09:00:00Z'));
    const { expires, signature } = sign(BUCKET, PATH, 60);
    vi.setSystemTime(new Date('2026-08-29T09:00:59Z'));
    expect(verify(BUCKET, PATH, expires, signature)).toBe('ok');
  });

  it('refuses a missing, empty or garbage signature', () => {
    const { expires } = sign(BUCKET, PATH, 60);
    expect(verify(BUCKET, PATH, expires, '')).toBe('invalid');
    expect(verify(BUCKET, PATH, expires, 'not-a-signature')).toBe('invalid');
    expect(verify(BUCKET, PATH, expires, 'x'.repeat(43))).toBe('invalid');
  });

  it('refuses a non-numeric expiry', () => {
    const { signature } = sign(BUCKET, PATH, 60);
    expect(verify(BUCKET, PATH, Number.NaN, signature)).toBe('invalid');
  });

  it('cannot be confused by a delimiter shift between bucket and path', () => {
    // ("a/b", "c") and ("a", "b/c") must not collide.
    const a = sign('a/b', 'c', 60);
    expect(verify('a', 'b/c', a.expires, a.signature)).toBe('invalid');
  });

  it('gives a different signature for every expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T09:00:00Z'));
    const first = sign(BUCKET, PATH, 60);
    vi.setSystemTime(new Date('2026-08-29T09:00:30Z'));
    const second = sign(BUCKET, PATH, 60);
    expect(second.signature).not.toBe(first.signature);
  });
});

describe('signedPath', () => {
  it('builds a URL that verifies', () => {
    const url = signedPath(BUCKET, PATH, 60);
    const q = new URLSearchParams(url.slice(url.indexOf('?') + 1));
    expect(url.startsWith(`/storage/${BUCKET}/object?`)).toBe(true);
    expect(
      verify(BUCKET, q.get('path')!, Number(q.get('expires')), q.get('signature')!),
    ).toBe('ok');
  });

  it('percent-encodes a path with characters that would break the query', () => {
    const url = signedPath(BUCKET, 'a b/c&d.jpg', 60);
    const q = new URLSearchParams(url.slice(url.indexOf('?') + 1));
    expect(q.get('path')).toBe('a b/c&d.jpg');
  });
});
