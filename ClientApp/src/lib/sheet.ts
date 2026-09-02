// Parse an uploaded spreadsheet (CSV or XLSX) into row objects keyed by header.
import Papa from 'papaparse';
import { downloadBlob } from './download';

export type SheetRow = Record<string, string>;

async function parseCsv(file: File): Promise<SheetRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<SheetRow>(file, {
      header: true,
      skipEmptyLines: true,
      // Normalise headers so national_id / NATIONAL_ID / National_ID all map the
      // same — the import reads lowercase keys.
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (r) => resolve(r.data),
      error: reject,
    });
  });
}

async function parseXlsx(file: File): Promise<SheetRow[]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];

  // Find the header row: the first (within the top rows) that contains a known
  // key cell (`national_id` for the members import, `code` for the roster). This
  // lets a template carry a decorative row above the headers (e.g. Arabic day
  // names) without breaking the import. Falls back to row 1 for plain templates.
  const KEY_HEADERS = new Set(['national_id', 'code', 'member_code']);
  let headerRow = 1;
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    let found = false;
    ws.getRow(r).eachCell((cell) => {
      if (KEY_HEADERS.has(String(cell.value ?? '').trim().toLowerCase())) found = true;
    });
    if (found) {
      headerRow = r;
      break;
    }
  }

  const headers: string[] = [];
  ws.getRow(headerRow).eachCell((cell, col) => {
    // Lowercase so national_id / NATIONAL_ID map the same (matches CSV parsing).
    headers[col] = String(cell.value ?? '').trim().toLowerCase();
  });

  const rows: SheetRow[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj: SheetRow = {};
    let any = false;
    row.eachCell((cell, col) => {
      const key = headers[col];
      if (!key) return;
      const v = cell.value;
      obj[key] = v == null ? '' : String(typeof v === 'object' && 'text' in v ? v.text : v).trim();
      if (obj[key]) any = true;
    });
    if (any) rows.push(obj);
  }
  return rows;
}

export async function parseSheet(file: File): Promise<SheetRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseXlsx(file);
  return parseCsv(file);
}

/** Build and download an .xlsx template with the given headers + one example row. */
export async function downloadTemplate(
  filename: string,
  headers: string[],
  sampleRow?: SheetRow,
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Template');
  ws.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(16, h.length + 4) }));
  if (sampleRow) ws.addRow(sampleRow);
  ws.getRow(1).font = { bold: true };

  // Thin dark-grey borders on the header + sample cells so it reads as a table.
  const line = { style: 'thin' as const, color: { argb: 'FF595959' } };
  const box = { top: line, left: line, bottom: line, right: line };
  const lastRow = sampleRow ? 2 : 1;
  for (let r = 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= headers.length; c++) row.getCell(c).border = box;
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  );
}

