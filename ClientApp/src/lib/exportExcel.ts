// Styled .xlsx export (exceljs handles Arabic/UTF-8 natively).
import { downloadBlob } from './download';
import { CALAIX } from './config';
import { PALETTE } from './colors';
import { appNow } from './clock';
import type { Brand } from './branding';

/** Convert a CSS hex color (#rrggbb) to Excel's aarrggbb. */
const toArgb = (hex?: string): string | undefined =>
  hex ? `FF${hex.replace('#', '').toUpperCase()}` : undefined;

const TEAL = toArgb(PALETTE.accent)!;
const TEAL_DARK = toArgb(PALETTE.accentDark)!;
const HAIRLINE = toArgb(PALETTE.hairline)!;
const STRIPE = toArgb(PALETTE.stripe)!;

export async function exportExcel(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  opts: { rtl?: boolean; cellColors?: (string | undefined)[][]; brand?: Brand } = {},
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const brand = opts.brand ?? { name: CALAIX.name, logo: CALAIX.logo };
  const wb = new ExcelJS.Workbook();
  wb.creator = CALAIX.name; // developer (unchanged); org branding goes in the banner
  wb.company = CALAIX.name;

  // Excel sheet names disallow * ? : \ / [ ] and are capped at 31 chars.
  const safeName = (title || 'Report').replace(/[*?:\\/[\]]/g, ' ').trim().slice(0, 31) || 'Report';
  const ws = wb.addWorksheet(safeName, {
    views: [{ rightToLeft: opts.rtl ?? true, state: 'frozen', ySplit: 2 }],
  });

  const cols = headers.length;
  const thin = { style: 'thin' as const, color: { argb: HAIRLINE } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  // Row 1 — title banner (merged), teal, prefixed with the organization name.
  ws.mergeCells(1, 1, 1, cols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${brand.name} — ${title}`;
  titleCell.font = { bold: true, size: 14, color: { argb: TEAL_DARK } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  // Best-effort logo image in the banner (raster only — xlsx can't embed SVG).
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(brand.logo);
  if (m) {
    try {
      const imgId = wb.addImage({
        base64: m[2],
        extension: m[1].toLowerCase() === 'png' ? 'png' : 'jpeg',
      });
      ws.addImage(imgId, {
        tl: { col: 0, row: 0 },
        ext: { width: 96, height: 24 },
        editAs: 'oneCell',
      });
    } catch {
      /* non-fatal — fall back to name-only branding */
    }
  }

  // Row 2 — column headers, teal fill + white bold.
  const headerRow = ws.getRow(2);
  headerRow.values = headers;
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
    cell.border = border;
  });

  // Data rows (from row 3), bordered. Status color wins over the zebra stripe.
  rows.forEach((r, i) => {
    const row = ws.addRow(r);
    row.eachCell((cell, col) => {
      cell.border = border;
      cell.alignment = {
        horizontal: col === 1 ? (opts.rtl ?? true ? 'right' : 'left') : 'center',
        vertical: 'middle',
      };
      const statusFill = toArgb(opts.cellColors?.[i]?.[col - 1]);
      if (statusFill) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusFill } };
        cell.font = { bold: true };
      } else if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE } };
      }
    });
  });

  // Column widths (first column = names, wider).
  ws.columns.forEach((c, i) => {
    c.width = i === 0 ? 26 : 14;
  });

  // Footer — Calaix branding, one blank row then a merged muted line.
  const footerRowIdx = ws.rowCount + 2;
  ws.mergeCells(footerRowIdx, 1, footerRowIdx, cols);
  const year = appNow().getFullYear();
  const footer = ws.getCell(footerRowIdx, 1);
  footer.value = `© ${year} ${CALAIX.name} · ${CALAIX.url.replace(/^https?:\/\//, '')}`;
  footer.font = { size: 9, color: { argb: 'FF98A2B3' }, italic: true };
  footer.alignment = { horizontal: 'center' };

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`,
  );
}
