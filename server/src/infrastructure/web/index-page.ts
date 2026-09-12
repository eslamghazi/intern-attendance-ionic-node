// The app's index.html, branded for the organisation on the way out.
//
// A link preview — WhatsApp, Telegram, Facebook, Slack — is built by a crawler
// that fetches the page and reads its <meta> tags. It never runs the app, so
// the organisation's name and logo, which live in Settings, cannot reach it
// through the app; they have to be in the HTML the server sends. And the
// image and canonical URL a preview needs must be ABSOLUTE, which only the
// server knows at request time.
//
// The built index.html carries sensible defaults (ClientApp/index.html). This
// rewrites the handful of values a preview shows and leaves everything else
// byte for byte as Vite produced it — the script tags with their hashes above
// all.

export interface IndexBranding {
  /** The organisation's name, or undefined for the app's own. */
  orgName?: string;
  /** `https://host`, no trailing slash. */
  origin: string;
  /** Absolute URL of the preview image. */
  imageUrl: string;
}

/** The app's own name — the title's second half, and the whole of it with no organisation. */
export const APP_NAME = 'نظام الحضور';

/** One line about what the app is, for the preview's description. */
export const APP_DESCRIPTION = 'نظام تسجيل حضور طلاب الامتياز — بالوجه والموقع';

/** Replace the content of one <meta> by its `property` or `name`. */
function setMeta(html: string, attr: 'property' | 'name', key: string, value: string): string {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`);
  return html.replace(re, `$1${escapeAttr(value)}$2`);
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

export function brandIndexHtml(html: string, b: IndexBranding): string {
  const title = b.orgName ? `${b.orgName} — ${APP_NAME}` : APP_NAME;
  const description = b.orgName ? `${APP_DESCRIPTION} · ${b.orgName}` : APP_DESCRIPTION;
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeText(title)}</title>`);
  out = setMeta(out, 'name', 'description', description);
  out = setMeta(out, 'property', 'og:site_name', b.orgName ?? APP_NAME);
  out = setMeta(out, 'property', 'og:title', title);
  out = setMeta(out, 'property', 'og:description', description);
  out = setMeta(out, 'property', 'og:image', b.imageUrl);
  out = setMeta(out, 'property', 'og:url', `${b.origin}/`);
  out = setMeta(out, 'name', 'twitter:title', title);
  out = setMeta(out, 'name', 'twitter:description', description);
  out = setMeta(out, 'name', 'twitter:image', b.imageUrl);
  // The home-screen name on iOS: the organisation's, when there is one.
  out = setMeta(out, 'name', 'apple-mobile-web-app-title', b.orgName ?? APP_NAME);
  return out;
}
