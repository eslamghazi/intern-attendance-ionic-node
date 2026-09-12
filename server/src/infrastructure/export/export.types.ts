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
  /** The organisation's name, in front of the title. Filled by ExportService. */
  brandName?: string;
  /**
   * The organisation's logo as a `data:image/…` URL, drawn in the print
   * document's header. Only ever an embedded image — see ExportService.
   */
  brandLogo?: string;
}

/** What ExportService reads from app_settings for every report. */
export interface ReportBranding {
  brandName?: string;
  brandLogo?: string;
}

export interface ReportDocument extends ReportTable {
  /** Portrait is unreadable once a table has a column per day. */
  landscape?: boolean;
  /** The filters this report covers, shown under the title. */
  subtitle?: string;
  /** When it was produced — a report without this cannot be filed. */
  generatedAt?: string;
  /**
   * Drawn above the table, in the order given. The print document renders
   * them as inline SVG; the workbook as a sheet of cell-drawn bars, because
   * a spreadsheet writer cannot make a native chart and a picture pasted into
   * one cannot be read back. Both carry the same numbers as the table.
   */
  charts?: ReportChart[];
}

/**
 * One mark of a chart: a bar, a slice, a segment.
 *
 * `mark` is the one-character status glyph (✓ ! ✗ ·) from STATUS_STYLE. It
 * rides beside the label wherever the colour is a STATUS colour, so a printed
 * or colour-blind copy still tells present from late without the hue.
 */
export interface ChartItem {
  label: string;
  value: number;
  color: string;
  mark?: string;
  /**
   * There is no value here — a day on which nothing was settled. A line
   * breaks at it and a column is left out, so "nothing to measure" never
   * prints as a 0% that was measured.
   */
  gap?: boolean;
}

/** A named row of a stacked bar — one branch, split by status. */
export interface ChartStack {
  label: string;
  segments: ChartItem[];
}

/** One cell of a calendar heatmap; `null` is a day with nothing to say. */
export interface ChartCell {
  day: number;
  /** 0–100, or null when no slot was settled that day. */
  value: number | null;
  /** Shown in the tooltip-less print: "12/15". */
  detail?: string;
}

/**
 * The forms an export can draw.
 *
 * Every dashboard panel maps onto one of these. Some panels change form on
 * the way — a radar becomes bars, a polar area becomes a donut — because the
 * print medium has no hover to explain an unusual shape, and a bar carries the
 * same numbers legibly. The title travels unchanged so the reader finds the
 * panel they picked.
 */
export type ReportChart =
  | { kind: 'donut'; title: string; items: ChartItem[]; centerTop?: string; centerBottom?: string }
  | { kind: 'gauge'; title: string; percent: number; label: string; color: string }
  | { kind: 'bars'; title: string; items: ChartItem[] }
  | { kind: 'columns'; title: string; items: ChartItem[]; yMax: number; ySuffix?: string }
  | { kind: 'line'; title: string; items: ChartItem[]; yMax: number; ySuffix?: string }
  | { kind: 'stacked'; title: string; rows: ChartStack[]; legend: ChartItem[] }
  | {
      kind: 'heatmap';
      title: string;
      cells: ChartCell[];
      /** 0 = Sunday, as Date#getUTCDay reports it. */
      firstWeekday: number;
      /** Seven short names, Sunday first. */
      weekdays: string[];
      color: string;
    };

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
