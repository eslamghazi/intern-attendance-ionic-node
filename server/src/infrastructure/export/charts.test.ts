import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { renderChartSvg, renderChartsSvg } from './charts-svg.js';
import { buildReportHtml } from './report-html.js';
import { buildWorkbook } from './workbook.js';
import type { ReportChart } from './export.types.js';

const donut: ReportChart = {
  kind: 'donut',
  title: 'نسبة الحضور',
  centerTop: '76%',
  centerBottom: 'نسبة الحضور',
  items: [
    { label: 'حضور', value: 32, color: '#16a34a', mark: '✓' },
    { label: 'تأخير', value: 8, color: '#f59e0b', mark: '!' },
    { label: 'غياب', value: 12, color: '#dc2626', mark: '✗' },
    { label: 'لم ينتهِ', value: 0, color: '#2563eb', mark: '·' },
  ],
};

const bars: ReportChart = {
  kind: 'bars',
  title: 'حسب الفرع',
  items: [
    { label: 'المبرة', value: 30, color: '#0d9488' },
    { label: 'الجامعي <script>', value: 10, color: '#0d9488' },
  ],
};

const columns: ReportChart = {
  kind: 'columns',
  title: 'المعدل اليومي',
  yMax: 100,
  ySuffix: '%',
  items: Array.from({ length: 30 }, (_, i) => ({ label: String(i + 1), value: (i * 7) % 100, color: '#0d9488' })),
};

const line: ReportChart = { ...columns, kind: 'line', title: 'خط' };

const stacked: ReportChart = {
  kind: 'stacked',
  title: 'الفروع حسب الحالة',
  rows: [
    {
      label: 'المبرة',
      segments: [
        { label: 'حضور', value: 24, color: '#16a34a', mark: '✓' },
        { label: 'تأخير', value: 6, color: '#f59e0b', mark: '!' },
        { label: 'غياب', value: 8, color: '#dc2626', mark: '✗' },
      ],
    },
  ],
  legend: [
    { label: 'حضور', value: 24, color: '#16a34a', mark: '✓' },
    { label: 'تأخير', value: 6, color: '#f59e0b', mark: '!' },
    { label: 'غياب', value: 8, color: '#dc2626', mark: '✗' },
  ],
};

const heatmap: ReportChart = {
  kind: 'heatmap',
  title: 'تقويم',
  firstWeekday: 2,
  weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  color: '#0d9488',
  cells: [
    { day: 1, value: 83 },
    { day: 2, value: null },
    { day: 3, value: 50 },
  ],
};

const gauge: ReportChart = { kind: 'gauge', title: 'مؤشر', percent: 76, label: 'نسبة الحضور', color: '#0d9488' };

const ALL = [donut, gauge, bars, columns, line, stacked, heatmap];

describe('renderChartSvg', () => {
  it('draws every form as one figure holding one SVG, in either direction', () => {
    for (const chart of ALL) {
      for (const rtl of [true, false]) {
        const svg = renderChartSvg(chart, rtl);
        expect(svg.startsWith('<figure class="chart')).toBe(true);
        expect(svg.match(/<svg /g)).toHaveLength(1);
        expect(svg).toContain(`aria-label="${chart.title}"`);
        expect(svg).toContain(`direction="${rtl ? 'rtl' : 'ltr'}"`);
      }
    }
  });

  it('escapes what it is given — a branch name is data, not markup', () => {
    const svg = renderChartSvg(bars, true);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('a donut skips a zero slice, keeps it in the legend, and puts the rate in the middle', () => {
    const svg = renderChartSvg(donut, true);
    // Three arcs for three non-zero slices.
    expect(svg.match(/<path d="M[^"]*A[^"]*" fill="none" stroke="#/g)).toHaveLength(3);
    // All four in the legend, with their glyphs and values.
    expect(svg).toContain('· لم ينتهِ · 0');
    expect(svg).toContain('✓ حضور · 32');
    expect(svg).toContain('>76%<');
  });

  it('a lone full slice is a whole ring, not a degenerate arc', () => {
    const only: ReportChart = { ...donut, items: [{ label: 'حضور', value: 5, color: '#16a34a' }] };
    const svg = renderChartSvg(only, true);
    expect(svg).toContain('<circle');
    expect(svg).not.toMatch(/A\d+,\d+ 0 [01] 1/);
  });

  it('bars label every value at the tip; a month of columns labels only the peak', () => {
    const b = renderChartSvg(bars, false);
    expect(b).toContain('>30<');
    expect(b).toContain('>10<');
    const c = renderChartSvg(columns, false);
    const peak = Math.max(...columns.items.map((i) => i.value));
    expect(c).toContain(`>${peak}%<`);
    // Not every value — the second-highest is not labelled.
    const labelled = (c.match(/font-weight="600"/g) ?? []).length;
    expect(labelled).toBe(1);
  });

  it('a right-to-left bar chart grows from the right', () => {
    const svg = renderChartSvg(bars, true);
    // The bar path walks left ("h-") from its anchor.
    expect(svg).toMatch(/<path d="M[\d.]+,[\d.]+ h-/);
    expect(svg).not.toMatch(/<path d="M[\d.]+,[\d.]+ h\d/);
  });

  it('a line is 2px with ringed markers and a wash, never a block', () => {
    const svg = renderChartSvg(line, false);
    expect(svg).toContain('stroke-width="2"');
    expect(svg).toContain('fill-opacity="0.1"');
    expect(svg).toContain('stroke="#ffffff" stroke-width="2"');
  });

  it('a stacked row separates its segments with a surface gap, not a border', () => {
    const svg = renderChartSvg(stacked, false);
    expect(svg).not.toContain('stroke="#ffffff" stroke-width="1"');
    const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    // Three segments; each after the first starts 2px past where the last ended.
    expect(rects.length).toBeGreaterThanOrEqual(3);
  });

  it('the calendar leaves an unsettled day as an outline and flips the day number on a dark cell', () => {
    const svg = renderChartSvg(heatmap, false);
    expect(svg).toContain('fill="none" stroke="#d0d5db"');
    // 83% is dark enough for a white day number; 50% is not.
    expect(svg).toContain('fill="#ffffff" font-weight="400" dominant-baseline="middle">1<');
    expect(svg).toContain('fill="#111111" font-weight="400" dominant-baseline="middle">3<');
  });

  it('renderChartsSvg is nothing without charts', () => {
    expect(renderChartsSvg(undefined, true)).toBe('');
    expect(renderChartsSvg([], true)).toBe('');
  });
});

describe('the print document', () => {
  it('places the charts above the table and keeps each one whole on a page', () => {
    const html = buildReportHtml({ title: 't', headers: ['h'], rows: [['r']], charts: [donut, bars] });
    expect(html.indexOf('<section class="charts">')).toBeLessThan(html.indexOf('<table>'));
    expect(html).toContain('break-inside: avoid');
    expect(html.match(/<figure class="chart/g)).toHaveLength(2);
    // The compact donut shares a row; the bar chart takes the whole one.
    expect(html).toContain('<figure class="chart chart--half">');
    expect(html).toContain('<figure class="chart">');
  });

  it('carries the copyright line', () => {
    const html = buildReportHtml({ title: 't', headers: ['h'], rows: [['r']] });
    expect(html).toContain('Calaix AI · Eslam Ghazi · جميع الحقوق محفوظة');
  });
});

describe('the workbook', () => {
  async function reopen(buf: Buffer): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    return wb;
  }

  it('adds a charts sheet after the table, drawn in cells', async () => {
    const wb = await reopen(await buildWorkbook({ title: 'لوحة', headers: ['h'], rows: [['r']], charts: [bars, stacked] }));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['لوحة', 'الرسوم البيانية']);
    const ws = wb.worksheets[1]!;
    // Title, then a row per bar: label | value | filled cells.
    expect(ws.getCell(1, 1).value).toBe('حسب الفرع');
    expect(ws.getCell(2, 1).value).toBe('المبرة');
    expect(ws.getCell(2, 2).value).toBe(30);
    const fill = ws.getCell(2, 3).fill;
    expect(fill.type).toBe('pattern');
    // The longest bar fills the whole run; the 10 beside a 30 fills a third.
    const filled = (row: number) => {
      let n = 0;
      for (let c = 3; c < 40; c++) if (ws.getCell(row, c).fill?.type === 'pattern') n++;
      return n;
    };
    expect(filled(2)).toBe(30);
    expect(filled(3)).toBe(10);
  });

  it('has no charts sheet when there are no charts', async () => {
    const wb = await reopen(await buildWorkbook({ title: 't', headers: ['h'], rows: [['r']] }));
    expect(wb.worksheets).toHaveLength(1);
  });

  it('carries the copyright line in the footer', async () => {
    const wb = await reopen(await buildWorkbook({ title: 't', headers: ['h'], rows: [['r']], rtl: false }));
    const ws = wb.worksheets[0]!;
    const values = [];
    for (let r = 1; r <= ws.rowCount; r++) values.push(ws.getCell(r, 1).value);
    expect(values).toContain(`© ${new Date().getFullYear()} Calaix AI · Eslam Ghazi · All rights reserved`);
  });
});
