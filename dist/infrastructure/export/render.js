import { HTML_CONTENT_TYPE, XLSX_CONTENT_TYPE } from '../../config/constants.js';
import { attachment, buildWorkbook } from './workbook.js';
import { buildReportHtml } from './report-html.js';
/**
 * Anything that is not exactly `pdf` is a spreadsheet.
 *
 * Takes a plain string because that is what a query parameter is — the DTO has
 * already run `@IsIn(['xlsx', 'pdf'])` over it, and this is the one place that
 * decides what an absent one means.
 */
export function parseFormat(raw) {
    return raw?.toLowerCase() === 'pdf' ? 'pdf' : 'xlsx';
}
/**
 * Render a report and send it.
 *
 * One place, so the three export routes cannot drift on content types, on how a
 * filename is escaped, or on which format a missing parameter means.
 *
 * The HTML is NOT an attachment: it is meant to be opened, not saved. The client
 * writes it into a window it opened, which then prints itself.
 */
export async function sendReport(reply, format, doc, basename) {
    if (format === 'pdf') {
        await reply.header('content-type', HTML_CONTENT_TYPE).send(buildReportHtml(doc));
        return;
    }
    await reply
        .header('content-type', XLSX_CONTENT_TYPE)
        .header('content-disposition', attachment(`${basename}.xlsx`))
        .send(await buildWorkbook(doc));
}
//# sourceMappingURL=render.js.map