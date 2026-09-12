import ExcelJS from 'exceljs';
import { REPORT_FONT, REPORT_PALETTE as P, SHEET_NAME_ILLEGAL, SHEET_NAME_MAX, XLSX_CONTENT_TYPE, } from '../../config/constants.js';
import { copyrightLine } from './copyright.js';
import { addChartsSheet } from './charts-sheet.js';
import { reportLabel } from './labels.js';
/**
 * Report tables, as .xlsx.
 *
 * WHY THE SERVER BUILDS THE FILE
 *
 * An export is "every row that matches the current filters", and a client cannot
 * ask for that: it can only ask for a page. Building the file here removes the
 * question — the filter is applied once, in SQL, and nothing is capped, paged or
 * reassembled on the way out.
 *
 * It also removes the page-size argument entirely. A listing endpoint can cap
 * `page_size` at something sane for a grid, because nothing needs a ten-thousand
 * row page any more.
 *
 * MEMORY
 *
 * The workbook is built whole and returned as one buffer. That is correct at this
 * scale — a faculty is thousands of members, not millions — and the alternative
 * (a streaming writer) costs a great deal of complexity for a file nobody will
 * open if it is that large. If an export ever approaches six figures of rows, it
 * wants a different shape (a queued job and a link), not a streaming xlsx.
 */
/** `#rrggbb` to Excel's `aarrggbb`. */
function toArgb(hex) {
    if (!hex)
        return undefined;
    const clean = hex.replace('#', '').toUpperCase();
    return clean.length === 6 ? `FF${clean}` : undefined;
}
/** The shared palette, in the form Excel wants. See config/constants.ts. */
const ARGB = {
    accent: toArgb(P.accent),
    accentDark: toArgb(P.accentDark),
    hairline: toArgb(P.hairline),
    stripe: toArgb(P.stripe),
    muted: toArgb(P.muted),
    white: toArgb(P.white),
};
/**
 * Excel rejects `* ? : \ / [ ]` in a sheet name and truncates past 31 chars.
 * A title built from a branch name and a search term reaches both limits.
 */
function sheetName(title) {
    return title.replace(SHEET_NAME_ILLEGAL, ' ').trim().slice(0, SHEET_NAME_MAX) || 'Report';
}
export async function buildWorkbook(table) {
    const rtl = table.rtl ?? true;
    const brandName = table.brandName?.trim();
    const cols = Math.max(table.headers.length, 1);
    // Cairo for Arabic, Inter for Latin. The NAME is set rather than an embedded
    // font: a name Excel does not have degrades to a sensible default, while a
    // bad embed can make the file refuse to open.
    const fontName = rtl ? REPORT_FONT.ar : REPORT_FONT.en;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName(table.title), {
        views: [{ rightToLeft: rtl, state: 'frozen', ySplit: 2 }],
    });
    // Row 1 — the banner.
    ws.mergeCells(1, 1, 1, cols);
    const banner = ws.getCell(1, 1);
    banner.value = brandName ? `${brandName} — ${table.title}` : table.title;
    banner.font = { name: fontName, bold: true, size: 14, color: { argb: ARGB.accentDark } };
    banner.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 24;
    // The organisation's logo in the banner row, when it is an image Excel can
    // hold: exceljs embeds PNG and JPEG, and an uploaded logo is usually one of
    // those. An SVG logo shows in the print document and is left out here rather
    // than written as an image the file cannot open.
    const logo = /^data:image\/(png|jpeg);base64,(.+)$/.exec(table.brandLogo ?? '');
    if (logo) {
        ws.getRow(1).height = 44;
        const id = wb.addImage({ base64: logo[2], extension: logo[1] });
        ws.addImage(id, { tl: { col: 0.1, row: 0.1 }, ext: { width: 120, height: 48 } });
    }
    const thin = { style: 'thin', color: { argb: ARGB.hairline } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    // Row 2 — headers.
    const headerRow = ws.getRow(2);
    headerRow.values = table.headers;
    headerRow.height = 20;
    headerRow.eachCell((cell) => {
        cell.font = { name: fontName, bold: true, color: { argb: ARGB.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.accent } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = border;
    });
    // Data from row 3. A status colour wins over the zebra stripe, because the
    // stripe is decoration and the colour carries meaning.
    table.rows.forEach((row, i) => {
        const added = ws.addRow(row);
        added.eachCell((cell, col) => {
            cell.border = border;
            cell.alignment = {
                horizontal: col === 1 ? (rtl ? 'right' : 'left') : 'center',
                vertical: 'middle',
            };
            const status = toArgb(table.cellColors?.[i]?.[col - 1]);
            cell.font = { name: fontName };
            if (status) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: status } };
                cell.font = { name: fontName, bold: true };
            }
            else if (i % 2 === 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.stripe } };
            }
        });
    });
    // The first column holds names; the rest are dates, codes or counts.
    ws.columns.forEach((c, i) => {
        c.width = i === 0 ? 26 : 14;
    });
    // Footer, one blank row below the table: whose work this is.
    const footerRow = ws.rowCount + 2;
    ws.mergeCells(footerRow, 1, footerRow, cols);
    const footer = ws.getCell(footerRow, 1);
    footer.value = copyrightLine(rtl);
    footer.font = { name: fontName, size: 9, color: { argb: ARGB.muted }, italic: true };
    footer.alignment = { horizontal: 'center' };
    // The charts, when the report has any, on a sheet after the table.
    addChartsSheet(wb, table.charts, { name: reportLabel(rtl, 'charts'), rtl, font: fontName });
    // exceljs types this as its own ArrayBuffer alias; Buffer.from copies it once.
    return Buffer.from(await wb.xlsx.writeBuffer());
}
export { XLSX_CONTENT_TYPE };
/**
 * `Content-Disposition` for a download.
 *
 * Both forms on purpose: `filename=` is ASCII for old clients, `filename*=` is
 * the RFC 5987 UTF-8 form so an Arabic report name survives. Quotes and control
 * characters are stripped from the ASCII form — an unescaped quote there ends
 * the header value early and truncates the name.
 */
export function attachment(name) {
    const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
    return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
//# sourceMappingURL=workbook.js.map