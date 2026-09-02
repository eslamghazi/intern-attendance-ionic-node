// Shared contract for the spreadsheet-import options modal. A page builds an
// ImportStrategy (parse + how to apply); the reusable ImportModal drives the UI:
// pick file -> prepare (parse + detect which rows already exist) -> pick a
// conflict mode -> preview counts -> confirm -> apply.

/**
 * How to treat rows whose identity already exists in the database.
 * NOTE: there is deliberately no "insert as a duplicate" mode — members are
 * unique by national_id and roster days by (member, date, shift), so a duplicate
 * insert is rejected by the DB and would corrupt the record's identity.
 */
export type ImportMode = 'update' | 'skip' | 'fail';

/** One parsed row shown in the modal's preview table. */
export interface ImportRowPreview {
  /** Cell values aligned to the strategy's previewColumns. */
  cells: string[];
  status: 'new' | 'update' | 'invalid';
  /** Reason the row is invalid (already translated), if any. */
  error?: string;
}

export interface ImportPrepared {
  /** Valid rows ready to apply (already filtered of invalid/unmatched rows). */
  rows: unknown[];
  /** Every parsed row with its resolved status + error, for the preview table. */
  preview: ImportRowPreview[];
  /** How many valid rows already exist in the DB. */
  existing: number;
  /** How many valid rows are new. */
  fresh: number;
  /** Rows dropped during parsing (bad data / unresolved references). */
  invalid: number;
  /** Total rows parsed from the sheet. */
  total: number;
  /** Human-readable notes, e.g. "3 row(s) skipped: unknown branch". */
  notes: string[];
  /** Whether a given row already exists (drives skip/fail filtering). */
  isExisting: (row: unknown) => boolean;
  /** Strategy-specific extra payload carried from prepare() to apply(). */
  meta?: unknown;
}

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface ImportStrategy {
  /** i18n key for the modal title. */
  titleKey: string;
  accept: string;
  /** Column headers (already translated) for the preview table. */
  previewColumns: string[];
  /** Which conflict modes this entity supports, in display order. */
  modes: ImportMode[];
  defaultMode: ImportMode;
  downloadTemplate?: () => void | Promise<void>;
  prepare: (file: File) => Promise<ImportPrepared>;
  apply: (prepared: ImportPrepared, mode: ImportMode) => Promise<ImportSummary>;
}

export interface ModeCounts {
  create: number;
  update: number;
  skip: number;
  conflict: number;
  invalid: number;
  total: number;
  /** Fail mode with existing rows present — the import cannot proceed. */
  blocked: boolean;
}

/** Project the prepared rows into the counts a given mode would produce. */
export function countFor(p: ImportPrepared, mode: ImportMode): ModeCounts {
  return {
    create: p.fresh,
    update: mode === 'update' ? p.existing : 0,
    skip: mode === 'skip' ? p.existing : 0,
    conflict: mode === 'fail' ? p.existing : 0,
    invalid: p.invalid,
    total: p.total,
    blocked: mode === 'fail' && p.existing > 0,
  };
}
