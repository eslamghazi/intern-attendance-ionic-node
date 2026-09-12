import {
  HTML_CONTENT_TYPE,
  REPORT_FONT,
  REPORT_PALETTE as P,
} from '../../config/constants.js';
import type { ReportTable } from './workbook.js';
import type { ReportDocument } from './export.types.js';
import { copyrightLine } from './copyright.js';
import { renderChartsSvg } from './charts-svg.js';
export type { ReportDocument } from './export.types.js';

/**
 * The same report as a print-ready HTML document.
 *
 * WHY HTML AND NOT A PDF BUILT HERE
 *
 * Arabic needs bidi and glyph shaping — a letter changes form depending on its
 * neighbours — and no PDF library in Node does either. `pdfkit`, `jspdf` and
 * `@react-pdf` all lay out Arabic as disconnected letters in the wrong order,
 * which is worse than no export: it looks like a file until somebody reads it.
 *
 * A browser does shaping and bidi correctly, and every viewer already has one.
 * So the SERVER decides everything that is a report — which rows, in what order,
 * with which totals and colours, under the caller's filters — and the browser is
 * used for the one thing only it can do: turn that into pages. "Save as PDF" in
 * the print dialog produces the file.
 *
 * The alternative is a headless Chromium on the server, which is the same
 * rendering engine at the cost of a ~200MB dependency and a browser process per
 * export. That trade is worth making when a PDF must be produced with nobody
 * watching — emailed on a schedule, say — and not before.
 *
 * TYPOGRAPHY: Cairo for Arabic, Inter for Latin, both fetched from the webfont
 * host when the viewer is online and falling back to a stack that still renders
 * Arabic when not.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

/** Everything interpolated below is data from the database or a caller's filter. */
function esc(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ESCAPES[c]!);
}

export function buildReportHtml(doc: ReportDocument): string {
  const rtl = doc.rtl ?? true;
  const font = rtl ? REPORT_FONT.ar : REPORT_FONT.en;
  const align = rtl ? 'right' : 'left';
  const title = doc.brandName ? `${doc.brandName} — ${doc.title}` : doc.title;

  const head = doc.headers.map((h) => `<th>${esc(h)}</th>`).join('');

  const body = doc.rows
    .map((row, i) => {
      const cells = row
        .map((cell, j) => {
          const fill = doc.cellColors?.[i]?.[j];
          const style = fill ? ` style="background:${esc(fill)};font-weight:600"` : '';
          const first = j === 0 ? ' class="lead"' : '';
          return `<td${first}${style}>${esc(cell)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<!doctype html>
<html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ar' : 'en'}">
<head>
<meta charset="utf-8" />
<title>${esc(doc.title)}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${REPORT_FONT.webfontHref}" />
<style>
  @page { size: A4 ${doc.landscape ? 'landscape' : 'portrait'}; margin: 14mm 12mm 18mm; }
  * { font-family: '${font}', ${REPORT_FONT.fallback}; box-sizing: border-box; }
  body { margin: 0; color: ${P.text}; }
  .head { border-bottom: 2px solid ${P.accent}; padding-bottom: 8px; margin-bottom: 12px; }
  h1 { font-size: 16pt; margin: 0 0 2px; color: ${P.accentDark}; }
  .sub { font-size: 9pt; color: ${P.muted}; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th, td { border: 1px solid ${P.hairline}; padding: 4px 6px; text-align: center; }
  th { background: ${P.accent}; color: ${P.white}; font-weight: 700; }
  td.lead { text-align: ${align}; white-space: nowrap; }
  /* The stripe is decoration; an inline status colour must win over it. */
  tbody tr:nth-child(even) td:not([style]) { background: ${P.stripe}; }
  /* Repeat the header on every printed page — a day-column table runs long. */
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  .foot { margin-top: 10px; font-size: 8pt; color: ${P.muted}; text-align: center; }
  /* Charts: two to a row where the page allows, each kept whole on a page.
     The SVG's text inherits the document's font and direction, which is what
     shapes the Arabic in a legend the same way as in the table. */
  /* Two columns. A chart with an axis or a row of labels takes both — at half
     width its text shrinks past legibility — and only the compact forms (a
     donut, a gauge) share a row. */
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; margin: 0 0 14px; }
  .chart { grid-column: 1 / -1; margin: 0; padding: 8px 6px 4px; border: 1px solid ${P.hairline}; border-radius: 8px; break-inside: avoid; }
  .chart--half { grid-column: auto; }
  .chart figcaption { font-size: 10pt; font-weight: 700; color: ${P.accentDark}; margin: 0 4px 6px; text-align: ${align}; }
  .chart svg { display: block; font-family: inherit; }
  .chart svg text { font-family: inherit; }
  @media print { .hint { display: none; } }
  .hint {
    margin: 12px 0; padding: 8px 10px; border-radius: 6px;
    background: ${P.stripe}; color: ${P.accentDark}; font-size: 10pt; text-align: ${align};
  }
</style>
</head>
<body>
  <div class="head">
    <h1>${esc(title)}</h1>
    ${doc.subtitle ? `<div class="sub">${esc(doc.subtitle)}</div>` : ''}
    ${doc.generatedAt ? `<div class="sub">${esc(doc.generatedAt)}</div>` : ''}
  </div>

  <div class="hint">${
    rtl
      ? 'اختر «حفظ كـ PDF» من نافذة الطباعة.'
      : 'Choose “Save as PDF” in the print dialog.'
  }</div>

  ${renderChartsSvg(doc.charts, rtl)}

  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>

  <div class="foot">${esc(doc.generatedAt ?? '')}</div>
  <div class="foot">${esc(copyrightLine(rtl))}</div>

  <script>
    // Wait for the webfonts before printing: printing first lays the table out
    // in the fallback face and the saved PDF keeps those metrics.
    var go = function () { window.focus(); window.print(); };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(go).catch(go);
    } else {
      window.onload = go;
    }
  </script>
</body>
</html>`;
}

export { HTML_CONTENT_TYPE };
