// Centralised access to Vite environment variables.
//
// Everything here ends up in the shipped bundle, so it must stay PUBLIC. The
// app holds no key of any kind now: authorization travels as the signed session
// token, and every secret lives in the API's own environment.

// Base URL of the API, e.g. https://api.example.edu/api/v1 — no trailing slash.
const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
export const env = {
  apiUrl: apiUrl ?? '',
  /** True only when the API connection is configured. */
  isConfigured: Boolean(apiUrl),
  /** Kept as an alias while call sites settle; same answer as isConfigured. */
  isApiConfigured: Boolean(apiUrl),
};

if (!env.isConfigured) {
  // Surfaced as a config screen in the UI; logged here for developers.
  console.error('[config] Missing VITE_API_URL. Copy .env.example to .env and fill it in.');
}
