import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { attachment, buildWorkbook } from './workbook.js';
/** Read a produced file back the way Excel would. */
async function reopen(buf) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    return wb.worksheets[0];
}
describe('buildWorkbook', () => {
    it('produces a file Excel can open, with the banner, headers and rows in place', async () => {
        const ws = await reopen(await buildWorkbook({
            title: 'الأعضاء',
            brandName: 'كلية التمريض',
            headers: ['كود العضو', 'الاسم', 'الفرع'],
            rows: [
                ['2026010001', 'أحمد محمد', 'مستشفى المبرة'],
                ['2026010002', 'سارة علي', 'مستشفى المبرة'],
            ],
        }));
        // Row 1 banner, row 2 headers, rows from 3.
        expect(ws.getCell(1, 1).value).toBe('كلية التمريض — الأعضاء');
        expect(ws.getRow(2).values).toEqual([undefined, 'كود العضو', 'الاسم', 'الفرع']);
        expect(ws.getCell(3, 2).value).toBe('أحمد محمد');
        expect(ws.getCell(4, 1).value).toBe('2026010002');
    });
    it('keeps Arabic intact — the reason the file is xlsx and not a PDF built in Node', async () => {
        // Arabic in xlsx is just UTF-8 in XML, so it round-trips exactly. A PDF
        // would need shaping and bidi, which no Node PDF library does.
        const name = 'محمد عبد الرحمن';
        const ws = await reopen(await buildWorkbook({ title: 't', headers: ['h'], rows: [[name]] }));
        expect(ws.getCell(3, 1).value).toBe(name);
    });
    it('opens right-to-left by default, and left-to-right when asked', async () => {
        const ar = await reopen(await buildWorkbook({ title: 't', headers: ['h'], rows: [] }));
        expect(ar.views[0]?.rightToLeft).toBe(true);
        const en = await reopen(await buildWorkbook({ title: 't', headers: ['h'], rows: [], rtl: false }));
        expect(en.views[0]?.rightToLeft).toBe(false);
    });
    it('paints a per-cell status colour where one is given', async () => {
        const ws = await reopen(await buildWorkbook({
            title: 't',
            headers: ['a', 'b'],
            rows: [['x', 'y']],
            cellColors: [[undefined, '#16a34a']],
        }));
        const fill = ws.getCell(3, 2).fill;
        expect(fill.fgColor?.argb).toBe('FF16A34A');
    });
    it('survives a title Excel would reject as a sheet name', async () => {
        // `* ? : \ / [ ]` are illegal and 31 chars is the cap — a title built from a
        // branch name plus a search term reaches both.
        const ws = await reopen(await buildWorkbook({
            title: 'مراجعة: 09/2026 [المبرة] — بحث عن اسم طويل جدا جدا',
            headers: ['h'],
            rows: [],
        }));
        expect(ws.name.length).toBeLessThanOrEqual(31);
        expect(ws.name).not.toMatch(/[*?:\\/[\]]/);
    });
    it('handles an empty result — an export of nothing is still a valid file', async () => {
        const ws = await reopen(await buildWorkbook({ title: 't', headers: ['a'], rows: [] }));
        expect(ws.getRow(2).values).toEqual([undefined, 'a']);
    });
});
describe('attachment', () => {
    it('carries an Arabic filename in the RFC 5987 form and an ASCII fallback', () => {
        const header = attachment('الأعضاء.xlsx');
        expect(header).toMatch(/^attachment; filename="[\x20-\x7E]*"; filename\*=UTF-8''/);
        expect(decodeURIComponent(header.split("UTF-8''")[1])).toBe('الأعضاء.xlsx');
    });
    it('strips quotes, which would end the header value early and truncate the name', () => {
        const header = attachment('a"b.xlsx');
        expect(header.slice(0, header.indexOf('; filename*'))).toBe('attachment; filename="ab.xlsx"');
    });
});
//# sourceMappingURL=workbook.test.js.map