import { useEffect, useState } from 'react';
import { isModelReady } from './face';

export type FaceModelStatus = 'loading' | 'ready' | 'error';

/**
 * Preloads the on-device face model (downloads + caches it on first use) and
 * reports its status, so pages can show a "preparing face recognition" indicator
 * instead of silently stalling on the first capture. Pass enabled=false when face
 * recognition is bypassed — then it resolves to 'ready' without downloading.
 */
export function useFaceModel(enabled = true): FaceModelStatus {
  const [status, setStatus] = useState<FaceModelStatus>(enabled ? 'loading' : 'ready');
  useEffect(() => {
    if (!enabled) {
      setStatus('ready');
      return;
    }
    let alive = true;
    setStatus('loading');
    isModelReady().then((ok) => {
      if (alive) setStatus(ok ? 'ready' : 'error');
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return status;
}
