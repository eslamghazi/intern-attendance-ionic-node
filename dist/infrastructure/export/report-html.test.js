import { describe, it, expect } from 'vitest';
import { buildReportHtml } from './report-html.js';
import { REPORT_FONT } from '../../config/constants.js';
const base = { title: 'Report', headers: ['a'], rows: [['x']] };
describe('buildReportHtml', () => {
    it('is a complete document, right-to-left and in Cairo by default', () => {
        const html = buildReportHtml({ ...base, title: 'الأعضاء' });
        expect(html.startsWith('<!doctype html>')).toBe(true);
        expect(html).toContain('dir="rtl"');
        expect(html).toContain('lang="ar"');
        expect(html).toContain(`'${REPORT_FONT.ar}'`);
    });
    it('switches to Inter and left-to-right for English', () => {
        const html = buildReportHtml({ ...base, rtl: false });
        expect(html).toContain('dir="ltr"');
        expect(html).toContain(`'${REPORT_FONT.en}'`);
    });
    it('ESCAPES every value — a report renders names typed by people', () => {
        // A member named with a tag would otherwise execute in the print window,
        // which runs same-origin with the app.
        const html = buildReportHtml({
            title: '<script>alert(1)</script>',
            headers: ['<img src=x onerror=alert(2)>'],
            rows: [['" onmouseover="alert(3)']],
        });
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).not.toContain('<img src=x');
        expect(html).not.toContain('" onmouseover="');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&quot; onmouseover=&quot;');
    });
    it('does not escape the one script it writes itself', () => {
        // The auto-print script must survive; only interpolated DATA is escaped.
        expect(buildReportHtml(base)).toContain('window.print()');
    });
    it('paints a cell colour where the matrix gives one', () => {
        const html = buildReportHtml({
            ...base,
            headers: ['a', 'b'],
            rows: [['x', 'y']],
            cellColors: [[undefined, '#fee2e2']],
        });
        expect(html).toContain('background:#fee2e2');
    });
    it('repeats the table header on every printed page', () => {
        // A month of day-columns runs past one page; without this the second page
        // is a wall of numbers with nothing naming the columns.
        expect(buildReportHtml(base)).toContain('thead { display: table-header-group; }');
    });
    it('asks for landscape only when told', () => {
        expect(buildReportHtml(base)).toContain('size: A4 portrait');
        expect(buildReportHtml({ ...base, landscape: true })).toContain('size: A4 landscape');
    });
    it('waits for the webfont before printing', () => {
        // Printing first lays the table out in the fallback face, and the saved PDF
        // keeps those metrics.
        expect(buildReportHtml(base)).toContain('document.fonts.ready');
    });
    it('renders an empty result as a valid document with no rows', () => {
        const html = buildReportHtml({ title: 't', headers: ['a'], rows: [] });
        expect(html).toContain('<tbody></tbody>');
    });
});
//# sourceMappingURL=report-html.test.js.map