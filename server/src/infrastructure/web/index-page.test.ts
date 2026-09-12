import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_DESCRIPTION, APP_NAME, brandIndexHtml } from './index-page.js';

// The real file, so a tag renamed in ClientApp/index.html fails here and not
// in a WhatsApp preview.
const SOURCE = join(dirname(fileURLToPath(import.meta.url)), '../../../../ClientApp/index.html');
const html = readFileSync(SOURCE, 'utf8');

const meta = (out: string, attr: 'property' | 'name', key: string): string | undefined =>
  new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`).exec(out)?.[1];

describe('the index page, branded', () => {
  const org = brandIndexHtml(html, {
    orgName: 'كلية التمريض',
    origin: 'https://internattend.kfsnur.com',
    imageUrl: 'https://internattend.kfsnur.com/api/v1/settings/branding/logo.png',
  });

  it('puts the organisation before the app in the title, and in the preview', () => {
    expect(org).toContain(`<title>كلية التمريض — ${APP_NAME}</title>`);
    expect(meta(org, 'property', 'og:title')).toBe(`كلية التمريض — ${APP_NAME}`);
    expect(meta(org, 'name', 'twitter:title')).toBe(`كلية التمريض — ${APP_NAME}`);
    expect(meta(org, 'property', 'og:site_name')).toBe('كلية التمريض');
    expect(meta(org, 'name', 'apple-mobile-web-app-title')).toBe('كلية التمريض');
  });

  it('makes the image and the URL absolute — a crawler cannot resolve a relative one', () => {
    expect(meta(org, 'property', 'og:image')).toBe('https://internattend.kfsnur.com/api/v1/settings/branding/logo.png');
    expect(meta(org, 'name', 'twitter:image')).toBe('https://internattend.kfsnur.com/api/v1/settings/branding/logo.png');
    expect(meta(org, 'property', 'og:url')).toBe('https://internattend.kfsnur.com/');
  });

  it('describes the app, then names the organisation', () => {
    expect(meta(org, 'name', 'description')).toBe(`${APP_DESCRIPTION} · كلية التمريض`);
    expect(meta(org, 'property', 'og:description')).toBe(`${APP_DESCRIPTION} · كلية التمريض`);
  });

  it('is the app alone when Settings names no organisation', () => {
    const plain = brandIndexHtml(html, { origin: 'http://localhost:8787', imageUrl: 'http://localhost:8787/x.png' });
    expect(plain).toContain(`<title>${APP_NAME}</title>`);
    expect(meta(plain, 'property', 'og:title')).toBe(APP_NAME);
    expect(meta(plain, 'property', 'og:site_name')).toBe(APP_NAME);
    expect(meta(plain, 'name', 'description')).toBe(APP_DESCRIPTION);
  });

  it('escapes a name that carries markup — it is data from Settings', () => {
    const odd = brandIndexHtml(html, { orgName: 'A "B" <C>', origin: 'http://h', imageUrl: 'http://h/i.png' });
    expect(odd).toContain('content="A &quot;B&quot; &lt;C> — ');
    expect(odd).toContain('<title>A "B" &lt;C> — ');
    expect(odd).not.toContain('<C>');
  });

  it('touches nothing else — the script tags Vite wrote stay byte for byte', () => {
    const scripts = (s: string) => s.match(/<script[^>]*>/g);
    expect(scripts(org)).toEqual(scripts(html));
    expect(org.match(/<link[^>]*>/g)).toEqual(html.match(/<link[^>]*>/g));
  });
});
