// Print/Save-as-PDF via the browser. Unlike jsPDF (whose built-in fonts can't
// render Arabic and produce mojibake), the browser shapes Arabic + RTL
// correctly, so "Save as PDF" from the print dialog yields a clean report.
import { APP_TIMEZONE, CALAIX } from './config';
import { PALETTE } from './colors';
import { appNow } from './clock';
import type { Brand } from './branding';

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);

export function printReport(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  opts: {
    rtl?: boolean;
    landscape?: boolean;
    subtitle?: string;
    cellColors?: (string | undefined)[][];
    brand?: Brand;
    /** Optional chart images (PNG data URLs) rendered above the table. */
    images?: { label: string; dataUrl: string }[];
  } = {},
): void {
  const rtl = opts.rtl ?? true;
  const align = rtl ? 'right' : 'left';
  const brand = opts.brand ?? { name: CALAIX.name, logo: CALAIX.logo };
  // Organization logo (header): a data URL is embedded as-is; a public path is
  // resolved to an absolute URL. Calaix (developer) stays in the footer below.
  const logo = brand.logo.startsWith('data:') ? brand.logo : `${window.location.origin}${brand.logo}`;
  const calaixLogo = `${window.location.origin}${CALAIX.logo}`;
  const generated = appNow().toLocaleString(rtl ? 'ar-EG' : 'en-GB', {
    timeZone: APP_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const year = appNow().toLocaleDateString('en-GB', { timeZone: APP_TIMEZONE, year: 'numeric' });

  const html = `<!doctype html>
<html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ar' : 'en'}">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: A4 ${opts.landscape ? 'landscape' : 'portrait'}; margin: 14mm 12mm 18mm; }
  * { font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; box-sizing: border-box; }
  body { margin: 0; color: #111; }
  .head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; padding-bottom: 10px; margin-bottom: 12px;
    border-bottom: 2px solid ${PALETTE.accent};
  }
  .head .logo { height: 44px; }
  .head .titles { text-align: ${align}; }
  h1 { font-size: 18px; margin: 0; }
  .meta { color: #667085; font-size: 11px; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: ${opts.landscape ? '10px' : '12px'}; }
  th, td { border: 1px solid ${PALETTE.hairline}; padding: ${opts.landscape ? '3px 4px' : '6px 8px'}; text-align: ${align}; white-space: nowrap; }
  th { background: ${PALETTE.headerBg}; color: ${PALETTE.accentDark}; font-weight: 700; }
  tbody tr:nth-child(even) td { background: ${PALETTE.stripe}; }
  .footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 6px 0; font-size: 10px; color: #98a2b3;
    border-top: 1px solid ${PALETTE.hairline};
  }
  .footer img { height: 12px; opacity: 0.8; }
  .footer a { color: ${PALETTE.accent}; text-decoration: none; }
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .charts figure { margin: 0; border: 1px solid ${PALETTE.hairline}; border-radius: 8px; padding: 10px; text-align: center; break-inside: avoid; }
  .charts figcaption { font-size: 11px; color: #667085; margin-top: 6px; font-weight: 600; }
  .charts img { max-width: 100%; height: auto; }
</style>
</head>
<body>
  <div class="head">
    <div class="titles">
      <h1>${esc(title)}</h1>
      ${opts.subtitle ? `<div class="meta">${esc(opts.subtitle)}</div>` : ''}
      <div class="meta">${esc(generated)}</div>
    </div>
    <img class="logo" src="${logo}" alt="${esc(brand.name)}" />
  </div>

  ${
    opts.images && opts.images.length
      ? `<div class="charts">${opts.images
          .map(
            (im) =>
              `<figure><img src="${im.dataUrl}" alt="" />${im.label ? `<figcaption>${esc(im.label)}</figcaption>` : ''}</figure>`,
          )
          .join('')}</div>`
      : ''
  }

  <table>
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map(
        (r, ri) =>
          `<tr>${r
            .map((c, ci) => {
              const bg = opts.cellColors?.[ri]?.[ci];
              return `<td${bg ? ` style="background:${bg};font-weight:700"` : ''}>${esc(c)}</td>`;
            })
            .join('')}</tr>`,
      )
      .join('')}</tbody>
  </table>

  <div class="footer">
    <img src="${calaixLogo}" alt="" />
    <span>© ${esc(year)} ${esc(CALAIX.name)} · <a href="${CALAIX.url}">${esc(CALAIX.url.replace(/^https?:\/\//, ''))}</a></span>
  </div>

  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
