// A tiny observable store tracking whether the API is reachable. apiFetch flips
// it on network failures and 5xx responses — never on a 4xx, which is a normal
// answer — and `pingServer` probes /health to recover.
import { env } from './env';

type Listener = (reachable: boolean) => void;

let reachable = true;
const listeners = new Set<Listener>();

export function isReachable(): boolean {
  return reachable;
}

export function setReachable(value: boolean): void {
  if (reachable === value) return;
  reachable = value;
  listeners.forEach((l) => l(value));
}

export function subscribeReachable(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * Probe the Supabase health endpoint. Any HTTP response (even an auth error)
 * means the server is up; only a thrown network error or a 5xx means it's down.
 * Used by the "server unreachable" screen's retry + auto-retry.
 */
export async function pingServer(): Promise<boolean> {
  if (!env.isConfigured) return false;
  try {
    const res = await fetch(`${env.apiUrl}/health`, { cache: 'no-store' });
    const ok = res.status < 500;
    setReachable(ok);
    return ok;
  } catch {
    setReachable(false);
    return false;
  }
}
