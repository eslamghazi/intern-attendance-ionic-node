import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// PWA auto-update: when a newer version is deployed, the service worker updates
// and the app reloads onto it automatically — no banner, no user action. We also
// poll for updates hourly so a long-open session doesn't stay on a stale build.
const CHECK_MS = 60 * 60 * 1000; // hourly

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      window.setInterval(() => void registration.update(), CHECK_MS);
    },
  });

  // Apply the new version the moment it's ready (belt-and-suspenders alongside
  // the autoUpdate registerType, which already reloads on activation).
  useEffect(() => {
    if (needRefresh) void updateServiceWorker(true);
  }, [needRefresh, updateServiceWorker]);

  return null;
}
