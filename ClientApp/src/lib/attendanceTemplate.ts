// The attendance file: one row per rostered slot, times to be filled in.
//
// It is generated FROM the roster on purpose. An import can only land on a
// rostered (member, date, shift) — so the file that is handed out already
// lists exactly those, and the person typing fills the two time columns and
// nothing else. A row they add for a slot that was never rostered will be
// reported back as "no roster" and skipped.
import { downloadBlob } from './download';
import { ATTENDANCE_SHEET_NAMES } from './sheet';

/** The columns, in order. Lower-case: the reader lower-cases headers too. */
export const ATTENDANCE_COLUMNS = ['code', 'full_name', 'date', 'shift', 'check_in', 'check_out'] as const;

export interface AttendanceTemplateSlot {
  code: string;
  fullName: string;
  /** yyyy-MM-dd */
  date: string;
  /** The shift's KEY, as the roster file uses it. */
  shiftKey: string;
}

export async function downloadAttendanceTemplate(opts: {
  filename: string;
  slots: AttendanceTemplateSlot[];
  /** Column labels in the reader's language, for a second header row. */
  labels: Record<(typeof ATTENDANCE_COLUMNS)[number], string>;
}): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  // Named so the same sheet, copied into a roster workbook, is found there.
  const ws = wb.addWorksheet(ATTENDANCE_SHEET_NAMES[0]!, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 2 }] });
  ws.columns = ATTENDANCE_COLUMNS.map((key) => ({ key, width: key === 'full_name' ? 28 : 14 }));

  // Row 1: the keys the reader matches on. Row 2: what they mean.
  ws.addRow(Object.fromEntries(ATTENDANCE_COLUMNS.map((k) => [k, k])));
  ws.addRow(Object.fromEntries(ATTENDANCE_COLUMNS.map((k) => [k, opts.labels[k]])));
  ws.getRow(1).font = { bold: true };
  ws.getRow(2).font = { italic: true, color: { argb: 'FF6B7280' } };

  for (const s of opts.slots) {
    ws.addRow({ code: s.code, full_name: s.fullName, date: s.date, shift: s.shiftKey, check_in: '', check_out: '' });
  }

  // The time columns are what gets typed: text, so "08:05" stays "08:05".
  for (const key of ['check_in', 'check_out'] as const) {
    ws.getColumn(key).numFmt = '@';
    ws.getColumn(key).alignment = { horizontal: 'center' };
  }

  const line = { style: 'thin' as const, color: { argb: 'FF595959' } };
  const box = { top: line, left: line, bottom: line, right: line };
  for (let r = 1; r <= ws.rowCount; r++) {
    for (let c = 1; c <= ATTENDANCE_COLUMNS.length; c++) ws.getRow(r).getCell(c).border = box;
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    opts.filename,
  );
}
