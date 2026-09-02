import { useEffect, useState } from 'react';
import { isReachable, subscribeReachable } from './serverStatus';

/** Live "is the backend reachable?" flag (server reachability + browser online). */
export function useServerReachable(): boolean {
  const [reachable, setReachable] = useState(isReachable());
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => subscribeReachable(setReachable), []);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return reachable && online;
}
