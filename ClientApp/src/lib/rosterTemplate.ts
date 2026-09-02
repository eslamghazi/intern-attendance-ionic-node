// Builds the monthly-roster Excel template: an Arabic day-names row on top, the
// machine header row (code, full_name, day numbers, shift keys), one row per
// member with their current shifts pre-filled, per-member shift totals (COUNTIF
// formulas) ending in an ALL-shifts total column, and per-day shift totals at
// the bottom ending in an ALL-shifts total row. Re-uploadable: the importer
// detects the `code` header row and ignores the decorative rows. The member is
// keyed by their composed CODE (not the national ID).
import { downloadBlob } from './download';
import { EXAMPLE } from './exampleData';

export interface RosterTemplateMember {
  code: string;
  full_name: string;
  days: Record<number, string>;
}
export interface RosterTemplateShift {
  key: string;
  name: string;
}

const AR_WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export async function downloadRosterTemplate(opts: {
  year: number;
  month: number; // 1-12
  daysInMonth: number;
  shifts: RosterTemplateShift[];
  members: RosterTemplateMember[];
  filename: string;
  labels: { code: string; fullName: string; total: string };
}): Promise<void> {
  const { year, month, daysInMonth: D, shifts, members, filename, labels } = opts;

  // When there are no members, ship one illustrative example row so the template
  // shows what to fill (code + a couple of days holding the first shift key).
  const key0 = shifts[0]?.key;
  const memberList: RosterTemplateMember[] = members.length
    ? members
    : [
        {
          code: EXAMPLE.memberCode,
          full_name: EXAMPLE.fullName,
          days: key0 ? { 1: key0, 2: key0 } : {},
        },
      ];

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Roster');

  const COL_CODE = 1;
  const COL_NAME = 2;
  const firstDay = 3;
  const lastDay = firstDay + D - 1;
  const firstSum = lastDay + 1;
  // One column per shift, then a grand-total column across all of them.
  const colTotal = firstSum + shifts.length;
  const colLetter = (c: number) => ws.getColumn(c).letter;

  // Row 1: Arabic day names (informational — the importer skips this row).
  const r1 = ws.getRow(1);
  r1.getCell(COL_CODE).value = labels.code;
  r1.getCell(COL_NAME).value = labels.fullName;
  for (let d = 1; d <= D; d++) {
    r1.getCell(firstDay + d - 1).value = AR_WEEKDAYS[new Date(year, month - 1, d).getDay()];
  }
  shifts.forEach((s, i) => {
    r1.getCell(firstSum + i).value = s.name;
  });
  r1.getCell(colTotal).value = labels.total;

  // Row 2: machine header row (what the importer reads).
  const r2 = ws.getRow(2);
  r2.getCell(COL_CODE).value = 'code';
  r2.getCell(COL_NAME).value = 'full_name';
  for (let d = 1; d <= D; d++) r2.getCell(firstDay + d - 1).value = d;
  shifts.forEach((s, i) => {
    r2.getCell(firstSum + i).value = s.key;
  });
  r2.getCell(colTotal).value = labels.total;

  // Member rows (day cells pre-filled) + per-member shift totals (COUNTIF).
  const dataStart = 3;
  memberList.forEach((st, idx) => {
    const rowNum = dataStart + idx;
    const row = ws.getRow(rowNum);
    row.getCell(COL_CODE).value = st.code;
    row.getCell(COL_NAME).value = st.full_name;
    for (let d = 1; d <= D; d++) {
      const v = st.days[d];
      if (v) row.getCell(firstDay + d - 1).value = v;
    }
    const start = `${colLetter(firstDay)}${rowNum}`;
    const end = `${colLetter(lastDay)}${rowNum}`;
    shifts.forEach((s, i) => {
      row.getCell(firstSum + i).value = { formula: `COUNTIF(${start}:${end},"${s.key}")` };
    });
    // How many shifts this member has all month — the sum of their per-shift
    // counts, so the row always reconciles with the breakdown beside it.
    if (shifts.length) {
      row.getCell(colTotal).value = {
        formula: `SUM(${colLetter(firstSum)}${rowNum}:${colLetter(firstSum + shifts.length - 1)}${rowNum})`,
      };
    }
  });

  const dataEnd = dataStart + memberList.length - 1;

  // Per-day shift totals at the bottom (one row per shift), then an ALL-shifts
  // row: how many people are on duty each day.
  const totalsStart = dataEnd + 2; // leave a blank spacer row
  shifts.forEach((s, i) => {
    const rowNum = totalsStart + i;
    const row = ws.getRow(rowNum);
    row.getCell(COL_NAME).value = `${labels.total} — ${s.name}`;
    if (memberList.length > 0) {
      for (let d = 1; d <= D; d++) {
        const col = colLetter(firstDay + d - 1);
        row.getCell(firstDay + d - 1).value = {
          formula: `COUNTIF(${col}${dataStart}:${col}${dataEnd},"${s.key}")`,
        };
      }
      const sumCol = colLetter(firstSum + i);
      row.getCell(firstSum + i).value = { formula: `SUM(${sumCol}${dataStart}:${sumCol}${dataEnd})` };
    }
    row.font = { bold: true };
  });

  // The grand-total row: every shift added up, per day — and the month total
  // where it meets the grand-total column.
  const grandRow = totalsStart + shifts.length;
  if (shifts.length && memberList.length > 0) {
    const row = ws.getRow(grandRow);
    row.getCell(COL_NAME).value = labels.total;
    const sumOfShiftRows = (col: string) =>
      `SUM(${col}${totalsStart}:${col}${totalsStart + shifts.length - 1})`;
    for (let d = 1; d <= D; d++) {
      const col = colLetter(firstDay + d - 1);
      row.getCell(firstDay + d - 1).value = { formula: sumOfShiftRows(col) };
    }
    row.getCell(colTotal).value = { formula: sumOfShiftRows(colLetter(colTotal)) };
    row.font = { bold: true };
  }

  // Styling + freeze the two header rows and the id/name columns; RTL sheet.
  r1.font = { bold: true, color: { argb: 'FF008080' } };
  r2.font = { bold: true };
  ws.getColumn(COL_CODE).width = 16;
  ws.getColumn(COL_NAME).width = 22;
  for (let c = firstDay; c <= lastDay; c++) {
    ws.getColumn(c).width = 6;
    ws.getColumn(c).alignment = { horizontal: 'center' };
  }
  shifts.forEach((_, i) => {
    ws.getColumn(firstSum + i).width = 9;
    ws.getColumn(firstSum + i).alignment = { horizontal: 'center' };
  });
  ws.getColumn(colTotal).width = 10;
  ws.getColumn(colTotal).alignment = { horizontal: 'center' };
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 2, rightToLeft: true }];

  // Borders across the whole grid so it reads as a table on screen + print.
  // Dark grey (not light) so they are clearly visible over Excel's own gridlines.
  const line = { style: 'thin' as const, color: { argb: 'FF595959' } };
  const box = { top: line, left: line, bottom: line, right: line };
  const lastCol = colTotal;
  const totalsEnd = shifts.length && memberList.length > 0 ? grandRow : totalsStart + shifts.length - 1;
  const borderRow = (rowNum: number) => {
    const row = ws.getRow(rowNum);
    for (let c = 1; c <= lastCol; c++) row.getCell(c).border = box;
  };
  for (let r = 1; r <= dataEnd; r++) borderRow(r); // headers + member rows
  for (let r = totalsStart; r <= totalsEnd; r++) borderRow(r); // totals block

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  );
}
