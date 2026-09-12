/// <reference types="vitest" />

import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Modern target only: onnxruntime-web uses BigInt, and our runtimes are modern
// (Android System WebView / WKWebView / current desktop browsers). The legacy
// plugin's old targets (chrome64/safari12) predate BigInt and break the build.
export default defineConfig({
  // ONE env file for the whole project, at the repo root — the server's runtime
  // settings and the client's build settings together.
  //
  // Vite defaults this to the ClientApp folder, which is why a second `.env`
  // grew here. That one was a developer's own file, gitignored, and it set
  // VITE_API_URL=http://localhost:8787/api/v1 — so `npm run build` baked a
  // localhost address into the DEPLOYED bundle and the app asked the user's own
  // phone for the API.
  //
  // Putting the API's secrets in a file Vite reads is safe: only names starting
  // with VITE_ are exposed to client code, and this config sets no envPrefix
  // and no define() that would widen that.
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [
    react(),
    VitePWA({
      // 'autoUpdate': when a new version is deployed the service worker takes
      // over and the app reloads onto it automatically (skipWaiting +
      // clientsClaim) — no update banner, no user action. UpdatePrompt only
      // polls for new versions so a long-open session doesn't stay stale.
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['logo.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'نظام الحضور',
        short_name: 'نظام الحضور',
        description: 'نظام تسجيل الحضور',
        lang: 'ar',
        dir: 'rtl',
        theme_color: '#0d9488',
        background_color: '#0b1120',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          // Raster fallbacks: several Android launchers and every iOS home
          // screen ignore an SVG icon.
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell (JS/CSS/HTML/icons). The main bundle is a few MB.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        // The big AI files are cached at RUNTIME on first use (below), not
        // precached — so only the wasm variant the device actually needs (~12MB)
        // is stored, and the SW install stays light.
        globIgnores: ['**/models/**', '**/mediapipe/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/models\//, /^\/mediapipe\//],
        runtimeCaching: [
          {
            // Face model (onnx/tflite) + MediaPipe wasm: download ONCE, then
            // always serve from cache — never re-downloaded on later opens.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/models/') || url.pathname.startsWith('/mediapipe/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ai-assets-v1',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
        ],
      },
      // Let the service worker run on the dev server too, so caching can be tested
      // without a production build.
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 3000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
});
