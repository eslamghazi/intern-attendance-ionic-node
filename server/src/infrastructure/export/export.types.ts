// The shape a report takes before it becomes a file.
//
// Shared by every renderer — the workbook, the print document and the
// legend — so a report is described once and drawn several ways.

/** A rendered table, ready to become a file. */
export interface ReportTable {
  /** Sheet title and banner text. */
  title: string;
  headers: string[];
  rows: (string | number)[][];
  /**
   * Per-cell background, as CSS hex (`#rrggbb`), same shape as `rows`.
   * Used by the attendance matrix to colour-code a status per day.
   */
  cellColors?: (string | undefined)[][];
  /** Arabic-first: the sheet opens right-to-left unless told otherwise. */
  rtl?: boolean;
  /** Shown above the table, e.g. the branch and search terms an export covers. */
  brandName?: string;
}

export interface ReportDocument extends ReportTable {
  /** Portrait is unreadable once a table has a column per day. */
  landscape?: boolean;
  /** The filters this report covers, shown under the title. */
  subtitle?: string;
  /** When it was produced — a report without this cannot be filed. */
  generatedAt?: string;
}

/**
 * The key to the marks, generated from the same table that draws them.
 *
 * A legend maintained by hand is a legend that goes wrong: it describes a mark
 * nobody uses any more, or misses the one that was added last week — and either
 * way the reader trusts it. Built from ATTENDANCE_OUTCOME, it cannot.
 *
 * It goes on every export that shows attendance marks, because an exported file
 * outlives the screen it came from: somebody opens it months later with no app
 * beside it to explain what `✓⇥` meant.
 */
export interface LegendEntry {
  mark: string;
  fill: string;
  label: string;
}

/**
 * The two things a report can be.
 *
 * `xlsx` is a file the browser saves. `pdf` is a print-ready HTML document the
 * browser turns into one — see report-html.ts for why the PDF is not generated
 * here, which comes down to Arabic needing a shaping engine that no Node PDF
 * library has.
 */
export type ReportFormat = 'xlsx' | 'pdf';
