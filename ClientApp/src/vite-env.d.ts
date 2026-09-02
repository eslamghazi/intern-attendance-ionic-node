/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** External base URL for the ML assets (models + mediapipe wasm). No trailing
   *  slash. Empty/unset = serve from this app's own origin (public/). */
  readonly VITE_MODEL_BASE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
