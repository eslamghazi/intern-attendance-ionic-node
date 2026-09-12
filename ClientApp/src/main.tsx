import React from 'react';
import { createRoot } from 'react-dom/client';
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import App from './App';
import { STORAGE_KEYS } from './lib/config';
import './lib/i18n';

// Enables the in-app camera UI on the web so capture uses the camera
// (no gallery/file upload) — matching native behaviour.
defineCustomElements(window);

// Apply the saved theme before first paint: avoids a flash and ensures native
// controls (date/time picker icons) use the right color-scheme immediately.
(() => {
  try {
    const mode = localStorage.getItem(STORAGE_KEYS.THEME) || 'system';
    const dark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('ion-palette-dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch {
    /* ignore */
  }
})();

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
