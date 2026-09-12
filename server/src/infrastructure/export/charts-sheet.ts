import type ExcelJS from 'exceljs';
import { REPORT_PALETTE as P } from '../../config/constants.js';
import type { ChartItem, ReportChart } from './export.types.js';

/**
 * The dashboard's charts, on a sheet of their own, drawn in cells.
 *
 * exceljs writes no native charts, and a picture pasted into a sheet is a
 * picture: nothing in it can be selected, summed or read back. So each chart
 * is drawn the way a spreadsheet can draw — a label, its value, and a bar of
 * filled cells whose length is the value. It prints, it survives every
 * spreadsheet application, and the numbers beside the bars ARE the data.
 *
 * Forms that have no cell equivalent take the nearest one: a donut and a
 * gauge become bars (part-to-whole reads fine as bars), a line becomes the
 * same bars as the columns it shares data with, and a calendar heatmap is a
 * calendar — seven columns, one cell per day, the fill's darkness the rate.
 */

const BAR_CELLS = 30;
/** Columns: A label, B value, then the bar. */
const FIRST_BAR_COL = 3;

function toArgb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`;
}

/** The same one-hue ramp the SVG uses: white blended towards the colour. */
function blend(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (shift: number) => {
    const c = (n >> shift) & 0xff;
    const v = Math.round(255 + (c - 255) * alpha);
    return v.toString(16).padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

function fill(cell: ExcelJS.Cell, hex: string): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(hex) } };
}

interface Cursor {
  row: number;
}

function title(ws: ExcelJS.Worksheet, at: Cursor, text: string, font: string): void {
  at.row += 1;
  const cell = ws.getCell(at.row, 1);
  cell.value = text;
  cell.font = { name: font, size: 12, bold: true, color: { argb: toArgb(P.accentDark) } };
  at.row += 1;
}

/** One labelled bar: label | value | ███████ */
function barRow(ws: ExcelJS.Worksheet, at: Cursor, item: ChartItem, max: number, font: string): void {
  const r = at.row;
  const label = ws.getCell(r, 1);
  label.value = `${item.mark ? item.mark + ' ' : ''}${item.label}`;
  label.font = { name: font, size: 10 };
  const value = ws.getCell(r, 2);
  value.value = item.value;
  value.font = { name: font, size: 10, bold: true };
  value.alignment = { horizontal: 'center' };
  const len = max > 0 ? Math.round((item.value / max) * BAR_CELLS) : 0;
  for (let i = 0; i < len; i++) fill(ws.getCell(r, FIRST_BAR_COL + i), item.color);
  at.row += 1;
}

/** One stacked row: label | total | ██▓▓░ segments in proportion. */
function stackRow(
  ws: ExcelJS.Worksheet,
  at: Cursor,
  label: string,
  segments: ChartItem[],
  max: number,
  font: string,
): void {
  const r = at.row;
  const total = segments.reduce((s, g) => s + g.value, 0);
  ws.getCell(r, 1).value = label;
  ws.getCell(r, 1).font = { name: font, size: 10 };
  ws.getCell(r, 2).value = total;
  ws.getCell(r, 2).font = { name: font, size: 10, bold: true };
  ws.getCell(r, 2).alignment = { horizontal: 'center' };
  let col = FIRST_BAR_COL;
  for (const seg of segments) {
    const len = max > 0 ? Math.round((seg.value / max) * BAR_CELLS) : 0;
    for (let i = 0; i < len; i++) fill(ws.getCell(r, col + i), seg.color);
    col += len;
  }
  at.row += 1;
}

function legendRow(ws: ExcelJS.Worksheet, at: Cursor, items: ChartItem[], font: string): void {
  const r = at.row;
  let col = 1;
  for (const it of items) {
    fill(ws.getCell(r, col), it.color);
    const cell = ws.getCell(r, col + 1);
    cell.value = `${it.mark ? it.mark + ' ' : ''}${it.label} · ${it.value}`;
    cell.font = { name: font, size: 9, color: { argb: toArgb(P.muted) } };
    col += 3;
  }
  at.row += 1;
}

function heatmapBlock(
  ws: ExcelJS.Worksheet,
  at: Cursor,
  chart: Extract<ReportChart, { kind: 'heatmap' }>,
  font: string,
): void {
  // Weekday header, then one row per week. A right-to-left sheet mirrors its
  // columns itself, so the calendar is laid out once and reads correctly in
  // either direction.
  const header = at.row;
  chart.weekdays.forEach((name, i) => {
    const cell = ws.getCell(header, FIRST_BAR_COL + i);
    cell.value = name;
    cell.font = { name: font, size: 9, color: { argb: toArgb(P.muted) } };
    cell.alignment = { horizontal: 'center' };
  });
  at.row += 1;
  let slot = chart.firstWeekday;
  for (const d of chart.cells) {
    const week = Math.floor(slot / 7);
    const wd = slot % 7;
    const cell = ws.getCell(at.row + week, FIRST_BAR_COL + wd);
    cell.value = d.value === null ? d.day : `${d.day}\n${d.value}%`;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.font = {
      name: font,
      size: 8,
      color: { argb: toArgb(d.value !== null && d.value >= 55 ? P.white : P.text) },
    };
    if (d.value !== null) fill(cell, blend(chart.color, 0.16 + 0.84 * (d.value / 100)));
    slot++;
  }
  const weeks = Math.ceil((chart.firstWeekday + chart.cells.length) / 7);
  for (let w = 0; w < weeks; w++) ws.getRow(at.row + w).height = 28;
  at.row += weeks;
}

/** Add a "charts" sheet to the workbook. No-op without charts. */
export function addChartsSheet(
  wb: ExcelJS.Workbook,
  charts: ReportChart[] | undefined,
  opts: { name: string; rtl: boolean; font: string },
): void {
  if (!charts?.length) return;
  const ws = wb.addWorksheet(opts.name, { views: [{ rightToLeft: opts.rtl, showGridLines: false }] });
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 9;
  for (let i = 0; i < BAR_CELLS; i++) ws.getColumn(FIRST_BAR_COL + i).width = 1.4;

  const at: Cursor = { row: 0 };
  for (const chart of charts) {
    title(ws, at, chart.title, opts.font);
    switch (chart.kind) {
      case 'donut':
      case 'bars': {
        const max = Math.max(0, ...chart.items.map((i) => i.value));
        for (const it of chart.items) barRow(ws, at, it, max, opts.font);
        break;
      }
      case 'gauge': {
        barRow(ws, at, { label: chart.label, value: chart.percent, color: chart.color }, 100, opts.font);
        break;
      }
      case 'columns':
      case 'line': {
        for (const it of chart.items) {
          barRow(ws, at, { ...it, label: `${it.label}` }, chart.yMax, opts.font);
        }
        break;
      }
      case 'stacked': {
        const max = Math.max(0, ...chart.rows.map((r) => r.segments.reduce((s, g) => s + g.value, 0)));
        for (const row of chart.rows) stackRow(ws, at, row.label, row.segments, max, opts.font);
        legendRow(ws, at, chart.legend, opts.font);
        break;
      }
      case 'heatmap':
        heatmapBlock(ws, at, chart, opts.font);
        break;
    }
    at.row += 1;
  }
}
