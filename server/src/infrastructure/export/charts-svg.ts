import { REPORT_PALETTE as P } from '../../config/constants.js';
import type { ChartItem, ReportChart } from './export.types.js';

/**
 * The dashboard's charts, as inline SVG for the print document.
 *
 * WHY SVG BUILT BY HAND
 *
 * The screen draws its charts on canvases, and a picture of a canvas exists
 * only in the browser that drew it. Rasterising one here would need a headless
 * browser or a native image library on the server — and would produce a
 * picture the reader cannot select, scale or search. SVG needs nothing, scales
 * to any paper, and its text is text: the Arabic in a label is shaped by the
 * same browser that shapes the table beside it.
 *
 * THE MARKS
 *
 * Thin bars (24px at most, rounded at the data end only, square at the
 * baseline), 2px lines with 8px markers ringed in the surface colour, a 2px
 * surface gap between touching fills, hairline solid gridlines one step off
 * the surface, and text in the text tokens — never in the series colour. A
 * legend whenever there is more than one series, with the value and the
 * status glyph beside each entry, so identity never rests on hue alone. Values
 * are labelled selectively: every bar of a short bar chart, only the peak of a
 * month of columns.
 *
 * RIGHT-TO-LEFT
 *
 * SVG does not mirror with `dir="rtl"`. Every layout here takes the document's
 * direction and lays bars from the right, anchors labels on the right, and
 * walks columns and calendar cells right-to-left, so an Arabic reader reads
 * the chart the way they read the page.
 */

const W = 600;
// Sized for the page, not the screen: a wide chart prints across the full
// text width (~700px at A4), a half chart at half of it, so 13px here is
// body-text size on paper.
const FONT = 13;
const TEXT = P.text;
const MUTED = P.muted;
const GRID = P.hairline;
const SURFACE = P.white;
const BAR = 18;
const GAP = 2;

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string | number): string => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]!);
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** A text node in a text token, never in a series colour. */
function text(
  x: number,
  y: number,
  content: string | number,
  opts: { anchor?: 'start' | 'middle' | 'end'; size?: number; color?: string; weight?: number } = {},
): string {
  const { anchor = 'start', size = FONT, color = TEXT, weight = 400 } = opts;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${color}" font-weight="${weight}" dominant-baseline="middle">${esc(content)}</text>`;
}

/**
 * A bar rounded at its data end and square at the baseline.
 *
 * `dir` says which way the bar grows from (x, y): right, left or up. The
 * radius is clipped to the bar's length so a tiny value is still a bar and
 * not a blob.
 */
function bar(x: number, y: number, length: number, thick: number, dir: 'right' | 'left' | 'up', color: string): string {
  const r = Math.min(4, Math.max(0, length) / 2);
  if (length <= 0) return '';
  if (dir === 'right') {
    return `<path d="M${x},${y} h${length - r} a${r},${r} 0 0 1 ${r},${r} v${thick - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${length - r} z" fill="${color}"/>`;
  }
  if (dir === 'left') {
    return `<path d="M${x},${y} h-${length - r} a${r},${r} 0 0 0 -${r},${r} v${thick - 2 * r} a${r},${r} 0 0 0 ${r},${r} h${length - r} z" fill="${color}"/>`;
  }
  // up: (x, y) is the bottom-left corner of the column
  return `<path d="M${x},${y} v-${length - r} a${r},${r} 0 0 1 ${r},-${r} h${thick - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${length - r} z" fill="${color}"/>`;
}

/** Swatch + glyph + label + value, one row of a legend, centred on the chart. */
function legend(items: ChartItem[], y: number, rtl: boolean): string {
  if (!items.length) return '';
  const per = Math.min(200, Math.floor(W / items.length));
  const start = (W - per * items.length) / 2;
  return items
    .map((it, i) => {
      // Entries run in reading order: the first on the right for Arabic.
      const x0 = rtl ? W - start - i * per : start + i * per;
      const sw = rtl ? x0 - 12 : x0;
      const tx = rtl ? x0 - 18 : x0 + 18;
      const label = `${it.mark ? it.mark + ' ' : ''}${it.label} · ${fmt(it.value)}`;
      return (
        `<rect x="${sw}" y="${y - 6}" width="12" height="12" rx="3" fill="${it.color}"/>` +
        text(tx, y, label, { anchor: 'start', color: TEXT })
      );
    })
    .join('');
}

/**
 * The figure around an SVG. `half` is for the compact forms — a donut, a
 * gauge — that read fine at half the page width; everything with an axis or
 * a row of labels takes the full width, or its text shrinks past legibility.
 */
function frame(height: number, body: string, title: string, rtl: boolean, half = false): string {
  // The direction is set on the SVG itself rather than inherited, because
  // every `text-anchor` below relies on it: `start` is the right edge under
  // rtl, and a document that forgot its `dir` would silently mirror the
  // labels off the page.
  return (
    `<figure class="chart${half ? ' chart--half' : ''}"><figcaption>${esc(title)}</figcaption>` +
    `<svg viewBox="0 0 ${W} ${height}" width="100%" role="img" aria-label="${esc(title)}" font-family="inherit" direction="${rtl ? 'rtl' : 'ltr'}">${body}</svg>` +
    `</figure>`
  );
}

// ---------------------------------------------------------------------------

function donut(c: Extract<ReportChart, { kind: 'donut' }>, rtl: boolean): string {
  const items = c.items.filter((i) => i.value > 0);
  const total = items.reduce((s, i) => s + i.value, 0);
  const cx = W / 2;
  const cy = 96;
  const R = 78;
  const thick = 22;
  const r = R - thick / 2;
  let body = '';
  if (total > 0) {
    // Each slice is an arc of the ring, and a 2px surface gap between slices
    // comes from shaving a sliver of angle off each end rather than stroking a
    // border. A lone slice is a full ring.
    const gapAngle = items.length > 1 ? GAP / r : 0;
    let start = -Math.PI / 2;
    for (const it of items) {
      const sweep = (it.value / total) * 2 * Math.PI;
      const a0 = start + gapAngle / 2;
      const a1 = start + sweep - gapAngle / 2;
      if (sweep >= 2 * Math.PI - 1e-6) {
        body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${thick}"/>`;
      } else if (a1 > a0) {
        const x0 = cx + r * Math.cos(a0);
        const y0 = cy + r * Math.sin(a0);
        const x1 = cx + r * Math.cos(a1);
        const y1 = cy + r * Math.sin(a1);
        const large = a1 - a0 > Math.PI ? 1 : 0;
        body += `<path d="M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}" fill="none" stroke="${it.color}" stroke-width="${thick}" stroke-linecap="butt"/>`;
      }
      start += sweep;
    }
  } else {
    body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GRID}" stroke-width="${thick}"/>`;
  }
  if (c.centerTop) body += text(cx, cy - 8, c.centerTop, { anchor: 'middle', size: 24, weight: 700 });
  if (c.centerBottom) body += text(cx, cy + 16, c.centerBottom, { anchor: 'middle', size: 11, color: MUTED });
  // Two legend entries per row: four statuses do not fit one row at half width.
  body += legend(c.items.slice(0, 2), 210, rtl);
  body += legend(c.items.slice(2), 234, rtl);
  return frame(252, body, c.title, rtl, true);
}

function gauge(c: Extract<ReportChart, { kind: 'gauge' }>, rtl: boolean): string {
  const cx = W / 2;
  const cy = 120;
  const r = 90;
  const thick = 18;
  const pct = Math.max(0, Math.min(100, c.percent));
  // A half ring, left to right. The track is a lighter step of the fill's own
  // hue, drawn as the same colour at low opacity, so state reads across the
  // whole arc rather than fill-on-grey.
  const arc = (from: number, to: number, color: string, opacity = 1) => {
    const a0 = Math.PI + from * Math.PI;
    const a1 = Math.PI + to * Math.PI;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    return `<path d="M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${thick}" stroke-linecap="round"/>`;
  };
  let body = arc(0, 1, c.color, 0.18);
  if (pct > 0) body += arc(0, pct / 100, c.color);
  body += text(cx, cy - 24, `${fmt(pct)}%`, { anchor: 'middle', size: 28, weight: 700 });
  body += text(cx, cy + 2, c.label, { anchor: 'middle', size: 11, color: MUTED });
  body += text(cx - r, cy + 22, '0%', { anchor: 'middle', size: 11, color: MUTED });
  body += text(cx + r, cy + 22, '100%', { anchor: 'middle', size: 11, color: MUTED });
  return frame(152, body, c.title, rtl, true);
}

function bars(c: Extract<ReportChart, { kind: 'bars' }>, rtl: boolean): string {
  const items = c.items;
  const rowH = BAR + 10;
  const labelW = 150;
  const valueW = 44;
  const plotW = W - labelW - valueW - 16;
  const max = Math.max(1, ...items.map((i) => i.value));
  const top = 8;
  let body = '';
  // Hairline gridlines at quarter steps of the maximum, recessive.
  for (let k = 1; k <= 4; k++) {
    const gx = rtl ? W - labelW - 8 - (plotW * k) / 4 : labelW + 8 + (plotW * k) / 4;
    body += `<line x1="${gx}" x2="${gx}" y1="${top}" y2="${top + items.length * rowH}" stroke="${GRID}" stroke-width="1"/>`;
  }
  // `text-anchor` is direction-relative — `start` is the right edge in an
  // RTL document — so the anchors are the same both ways; only the x moves.
  items.forEach((it, i) => {
    const y = top + i * rowH + (rowH - BAR) / 2;
    const len = Math.round((it.value / max) * plotW);
    if (rtl) {
      const x0 = W - labelW - 8;
      body += text(W - 4, y + BAR / 2, it.label, { anchor: 'start' });
      body += bar(x0, y, len, BAR, 'left', it.color);
      body += text(x0 - len - 6, y + BAR / 2, fmt(it.value), { anchor: 'start', color: TEXT, weight: 600 });
    } else {
      const x0 = labelW + 8;
      body += text(4, y + BAR / 2, it.label, { anchor: 'start' });
      body += bar(x0, y, len, BAR, 'right', it.color);
      body += text(x0 + len + 6, y + BAR / 2, fmt(it.value), { anchor: 'start', color: TEXT, weight: 600 });
    }
  });
  return frame(top + items.length * rowH + 8, body, c.title, rtl);
}

/** Shared frame for the two daily forms: y axis 0..yMax, x as day numbers. */
function dailyFrame(
  items: ChartItem[],
  yMax: number,
  ySuffix: string,
  rtl: boolean,
): { top: number; bottom: number; left: number; plotW: number; plotH: number; body: string; xOf: (i: number) => number; slot: number } {
  const top = 14;
  const bottom = 172;
  const left = rtl ? 8 : 40;
  const right = rtl ? 40 : 8;
  const plotW = W - left - right;
  const plotH = bottom - top;
  const slot = plotW / Math.max(1, items.length);
  const xOf = (i: number) => (rtl ? W - right - (i + 0.5) * slot : left + (i + 0.5) * slot);
  let body = '';
  for (const k of [0, 0.5, 1]) {
    const y = bottom - plotH * k;
    body += `<line x1="${left}" x2="${W - right}" y1="${y}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`;
    body += text(rtl ? W - right + 6 : left - 6, y, `${fmt(yMax * k)}${ySuffix}`, {
      anchor: 'end',
      size: 11,
      color: MUTED,
    });
  }
  // Day numbers, thinned so they cannot collide: every day up to 15, else
  // every fifth and the last.
  const every = items.length > 15 ? 5 : 1;
  items.forEach((it, i) => {
    if (i % every === 0 || i === items.length - 1) {
      body += text(xOf(i), bottom + 12, it.label, { anchor: 'middle', size: 11, color: MUTED });
    }
  });
  return { top, bottom, left, plotW, plotH, body, xOf, slot };
}

function columns(c: Extract<ReportChart, { kind: 'columns' }>, rtl: boolean): string {
  const f = dailyFrame(c.items, c.yMax, c.ySuffix ?? '', rtl);
  const thick = Math.min(24, Math.max(4, Math.floor(f.slot) - GAP * 2));
  const peak = c.items.reduce((best, it, i) => (!it.gap && it.value > (c.items[best]?.value ?? -1) ? i : best), -1);
  let body = f.body;
  c.items.forEach((it, i) => {
    if (it.gap) return;
    const h = Math.round((it.value / Math.max(1, c.yMax)) * f.plotH);
    const x = f.xOf(i) - thick / 2;
    body += bar(x, f.bottom, h, thick, 'up', it.color);
    // Only the peak is labelled; the gridlines carry the rest.
    if (i === peak && it.value > 0) {
      body += text(f.xOf(i), f.bottom - h - 8, `${fmt(it.value)}${c.ySuffix ?? ''}`, { anchor: 'middle', size: 11, weight: 600 });
    }
  });
  return frame(f.bottom + 22, body, c.title, rtl);
}

function line(c: Extract<ReportChart, { kind: 'line' }>, rtl: boolean): string {
  const f = dailyFrame(c.items, c.yMax, c.ySuffix ?? '', rtl);
  const color = c.items[0]?.color ?? P.accent;
  // A gap ends one run and starts the next: the line is not drawn across a
  // day that measured nothing, because that would draw a value that was
  // never there.
  const runs: { x: number; y: number; value: number }[][] = [[]];
  c.items.forEach((it, i) => {
    if (it.gap) {
      if (runs[runs.length - 1]!.length) runs.push([]);
      return;
    }
    runs[runs.length - 1]!.push({ x: f.xOf(i), y: f.bottom - (it.value / Math.max(1, c.yMax)) * f.plotH, value: it.value });
  });
  const real = runs.filter((r) => r.length);
  let body = f.body;
  for (const pts of real) {
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    // The area is a wash of the same hue, never a block.
    body += `<path d="${path} L${last.x.toFixed(1)},${f.bottom} L${first.x.toFixed(1)},${f.bottom} Z" fill="${color}" fill-opacity="0.1"/>`;
    body += `<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  const all = real.flat();
  if (all.length) {
    // Markers on every point of a short series; on a month, only the run
    // ends, so they stay apart. Each is ringed in the surface colour.
    const marked = all.length > 15 ? real.flatMap((r) => (r.length > 1 ? [r[0]!, r[r.length - 1]!] : [r[0]!])) : all;
    for (const p of marked) {
      body += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${color}" stroke="${SURFACE}" stroke-width="2"/>`;
    }
    const last = all[all.length - 1]!;
    body += text(last.x + (rtl ? -8 : 8), last.y - 10, `${fmt(last.value)}${c.ySuffix ?? ''}`, {
      anchor: 'start',
      size: 11,
      weight: 600,
    });
  }
  return frame(f.bottom + 24, body, c.title, rtl);
}

function stacked(c: Extract<ReportChart, { kind: 'stacked' }>, rtl: boolean): string {
  const rowH = BAR + 10;
  const labelW = 150;
  // Room past the longest bar for its total, or the label of the widest row
  // runs off the page.
  const valueW = 44;
  const plotW = W - labelW - valueW - 16;
  const max = Math.max(1, ...c.rows.map((r) => r.segments.reduce((s, g) => s + g.value, 0)));
  const top = 8;
  let body = '';
  c.rows.forEach((row, i) => {
    const y = top + i * rowH + (rowH - BAR) / 2;
    body += text(rtl ? W - 4 : 4, y + BAR / 2, row.label, { anchor: 'start' });
    let cursor = rtl ? W - labelW - 8 : labelW + 8;
    row.segments.forEach((seg, j) => {
      const len = Math.round((seg.value / max) * plotW);
      if (len <= 0) return;
      // The 2px surface gap: each segment after the first starts a gap later
      // and is a gap shorter.
      const inset = j === 0 ? 0 : GAP;
      const drawn = Math.max(0, len - inset);
      if (rtl) {
        body += `<rect x="${cursor - inset - drawn}" y="${y}" width="${drawn}" height="${BAR}" fill="${seg.color}"/>`;
        cursor -= len;
      } else {
        body += `<rect x="${cursor + inset}" y="${y}" width="${drawn}" height="${BAR}" fill="${seg.color}"/>`;
        cursor += len;
      }
    });
    const total = row.segments.reduce((s, g) => s + g.value, 0);
    body += text(rtl ? cursor - 6 : cursor + 6, y + BAR / 2, fmt(total), { anchor: 'start', weight: 600 });
  });
  const legendY = top + c.rows.length * rowH + 14;
  body += legend(c.legend, legendY, rtl);
  return frame(legendY + 16, body, c.title, rtl);
}

function heatmap(c: Extract<ReportChart, { kind: 'heatmap' }>, rtl: boolean): string {
  const cell = 30;
  const gap = 3;
  const cols = 7;
  const left = (W - cols * (cell + gap)) / 2;
  const top = 22;
  const colX = (weekday: number) => (rtl ? left + (cols - 1 - weekday) * (cell + gap) : left + weekday * (cell + gap));
  let body = '';
  c.weekdays.forEach((name, wd) => {
    body += text(colX(wd) + cell / 2, 8, name, { anchor: 'middle', size: 11, color: MUTED });
  });
  let slot = c.firstWeekday;
  let rows = 0;
  for (const d of c.cells) {
    const wd = slot % cols;
    const week = Math.floor(slot / cols);
    rows = week + 1;
    const x = colX(wd);
    const y = top + week * (cell + gap);
    if (d.value === null) {
      body += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="4" fill="none" stroke="${GRID}"/>`;
      body += text(x + cell / 2, y + cell / 2, d.day, { anchor: 'middle', size: 11, color: MUTED });
    } else {
      // One hue, light to dark: the fill's opacity carries the rate, and the
      // day number flips to white once the fill is dark enough to need it.
      const alpha = 0.16 + 0.84 * (Math.max(0, Math.min(100, d.value)) / 100);
      body += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="4" fill="${c.color}" fill-opacity="${alpha.toFixed(2)}"/>`;
      body += text(x + cell / 2, y + cell / 2, d.day, { anchor: 'middle', size: 11, color: d.value >= 55 ? SURFACE : TEXT });
    }
    slot++;
  }
  // The scale legend a sequential ramp always needs.
  const ly = top + rows * (cell + gap) + 12;
  const steps = [0, 25, 50, 75, 100];
  steps.forEach((s, i) => {
    const x = rtl ? W / 2 + 40 - i * 20 : W / 2 - 40 + i * 20;
    body += `<rect x="${x}" y="${ly - 6}" width="16" height="12" rx="3" fill="${c.color}" fill-opacity="${(0.16 + 0.84 * (s / 100)).toFixed(2)}"/>`;
  });
  body += text(rtl ? W / 2 + 64 : W / 2 - 46, ly, '0%', { anchor: 'end', size: 11, color: MUTED });
  body += text(rtl ? W / 2 - 46 : W / 2 + 64, ly, '100%', { anchor: 'start', size: 11, color: MUTED });
  return frame(ly + 16, body, c.title, rtl);
}

/** One chart, as a `<figure>` holding an SVG. */
export function renderChartSvg(chart: ReportChart, rtl: boolean): string {
  switch (chart.kind) {
    case 'donut':
      return donut(chart, rtl);
    case 'gauge':
      return gauge(chart, rtl);
    case 'bars':
      return bars(chart, rtl);
    case 'columns':
      return columns(chart, rtl);
    case 'line':
      return line(chart, rtl);
    case 'stacked':
      return stacked(chart, rtl);
    case 'heatmap':
      return heatmap(chart, rtl);
  }
}

/** Every chart of a document, in order. */
export function renderChartsSvg(charts: ReportChart[] | undefined, rtl: boolean): string {
  if (!charts?.length) return '';
  return `<section class="charts">${charts.map((c) => renderChartSvg(c, rtl)).join('')}</section>`;
}
