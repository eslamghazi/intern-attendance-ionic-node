// Single source of truth for every semantic color used across the app and the
// PDF/Excel exports. Change a status color once, here.

export interface StatusColor {
  /** App pill background (translucent). */
  bg: string;
  /** App pill / text foreground. */
  fg: string;
  /** Solid tone for charts (donut/bars). */
  solid: string;
  /** Export cell fill (Excel/PDF), CSS hex; omit = no fill. */
  fill?: string;
  /** Short mark shown in the monthly grids and exports. */
  mark: string;
}

export const STATUS_COLOR: Record<string, StatusColor> = {
  present: { bg: 'rgba(22,163,74,0.14)', fg: '#16a34a', solid: '#16a34a', fill: '#dcfce7', mark: '✓' },
  late: { bg: 'rgba(245,158,11,0.16)', fg: '#b45309', solid: '#f59e0b', fill: '#fef9c3', mark: '!' },
  early_leave: { bg: 'rgba(245,158,11,0.16)', fg: '#b45309', solid: '#f59e0b', fill: '#fef9c3', mark: '↩' },
  absent: { bg: 'rgba(220,38,38,0.14)', fg: '#dc2626', solid: '#dc2626', fill: '#fee2e2', mark: '✗' },
  left_work: { bg: 'rgba(147,51,234,0.14)', fg: '#9333ea', solid: '#9333ea', fill: '#f3e8ff', mark: '⇥' },
  pending: { bg: 'rgba(37,99,235,0.12)', fg: '#2563eb', solid: '#2563eb', fill: '#dbeafe', mark: '·' },
};

/** Brand / report palette (also mirrors the teal Ionic primary). */
export const PALETTE = {
  accent: '#0d9488',
  accentDark: '#0f766e',
  hairline: '#d0d5db',
  stripe: '#f3faf9',
  headerBg: '#f0fdfa',
} as const;
