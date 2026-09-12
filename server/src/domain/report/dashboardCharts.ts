// The dashboard's chart panels, as charts an export can draw.
//
// The screen lets an admin pick which panels to show, and the export takes
// the same list, so the file holds the charts the reader was looking at. Each
// panel maps onto one of the forms in export.types.ts; where the screen's
// form has no static equivalent — a radar, a polar area, a bubble plot — the
// nearest one that carries the same numbers legibly on paper is drawn, under
// the panel's own title, so the reader still finds what they picked.
import { CHART_COLORS, STATUS_STYLE } from '../../config/constants.js';
import type { ChartItem, ReportChart } from '../../infrastructure/export/export.types.js';
import type { MonthStats } from './types.js';

/** The panel keys the screen knows. Anything else in the list is ignored. */
export const DASHBOARD_PANELS = [
  'donut',
  'gauge',
  'statusPie',
  'trendBar',
  'trendLine',
  'heatmap',
  'stacked',
  'radar',
  'polar',
  'bubble',
  'scatter',
  'branch',
  'group',
  'shift',
] as const;

export type DashboardPanel = (typeof DASHBOARD_PANELS)[number];

export interface Named {
  id: string;
  name: string;
}

export interface DashboardChartInput {
  stats: MonthStats;
  branches: Named[];
  groups: Named[];
  shifts: Named[];
  /** The month, for the calendar. */
  year: number;
  month: number;
  /** Seven short weekday names, Sunday first, in the reader's language. */
  weekdays: string[];
  /** `report.*` labels in the reader's language. */
  t: (key: string) => string;
}

/** The `charts` query parameter, parsed: known panels, in the order given. */
export function parsePanels(raw: string | undefined): DashboardPanel[] {
  if (!raw) return [];
  const known = new Set<string>(DASHBOARD_PANELS);
  const out: DashboardPanel[] = [];
  for (const part of raw.split(',')) {
    const key = part.trim();
    if (known.has(key) && !out.includes(key as DashboardPanel)) out.push(key as DashboardPanel);
  }
  return out;
}

function statusItems(s: MonthStats, t: DashboardChartInput['t'], withPending: boolean): ChartItem[] {
  const items: ChartItem[] = [
    { label: t('present'), value: s.present, color: CHART_COLORS.present, mark: STATUS_STYLE.present.mark },
    { label: t('late'), value: s.late, color: CHART_COLORS.late, mark: STATUS_STYLE.late.mark },
    { label: t('absent'), value: s.absent, color: CHART_COLORS.absent, mark: STATUS_STYLE.absent.mark },
  ];
  if (withPending) {
    items.push({ label: t('still_open'), value: s.pending, color: CHART_COLORS.pending, mark: STATUS_STYLE.pending.mark });
  }
  return items;
}

/** Per branch/group/shift: only what the caller can see, which is what scored. */
function perSeries<T extends { value: number }>(
  list: Named[],
  values: T[],
  idOf: (v: T) => string,
  color: string,
): ChartItem[] {
  return list
    .map((item) => ({
      label: item.name,
      value: values.find((v) => idOf(v) === item.id)?.value ?? 0,
      color,
    }))
    .filter((x) => x.value > 0);
}

/** The month's days as one series of daily rates; a day with nothing settled is a gap. */
function dailyRate(s: MonthStats, color: string): ChartItem[] {
  return s.perDay.map((d) =>
    d.settled > 0
      ? { label: String(d.day), value: d.rate, color }
      : { label: String(d.day), value: 0, color, gap: true },
  );
}

export function dashboardCharts(panels: DashboardPanel[], input: DashboardChartInput): ReportChart[] {
  const { stats: s, t } = input;
  const rateLabel = s.rateBasis === 'none' ? '—' : `${s.rate}%`;
  const hasDays = s.perDay.length > 0;
  const out: ReportChart[] = [];

  for (const panel of panels) {
    switch (panel) {
      case 'donut':
        out.push({
          kind: 'donut',
          title: t('chart_donut'),
          items: statusItems(s, t, true),
          centerTop: rateLabel,
          centerBottom: t('attendance_rate'),
        });
        break;
      case 'gauge':
        out.push({
          kind: 'gauge',
          title: t('chart_gauge'),
          percent: s.rateBasis === 'none' ? 0 : s.rate,
          label: t('attendance_rate'),
          color: CHART_COLORS.branch,
        });
        break;
      case 'statusPie':
        // A pie and a donut are one form on paper; the title keeps the panel's name.
        out.push({ kind: 'donut', title: t('chart_status_pie'), items: statusItems(s, t, true) });
        break;
      case 'polar':
        // A polar area is a pie whose radius carries the value; the same numbers.
        out.push({ kind: 'donut', title: t('chart_polar'), items: statusItems(s, t, false) });
        break;
      case 'trendBar':
      case 'bubble':
      case 'scatter':
        // Bubble and scatter plot the same daily rate against the day; on
        // paper, columns say it without needing hover to read a dot.
        if (hasDays) {
          const title = panel === 'trendBar' ? t('chart_trend_bar') : panel === 'bubble' ? t('chart_bubble') : t('chart_scatter');
          out.push({ kind: 'columns', title, items: dailyRate(s, CHART_COLORS.branch), yMax: 100, ySuffix: '%' });
        }
        break;
      case 'trendLine':
        if (hasDays) {
          out.push({ kind: 'line', title: t('chart_trend_line'), items: dailyRate(s, CHART_COLORS.branch), yMax: 100, ySuffix: '%' });
        }
        break;
      case 'heatmap':
        if (hasDays) {
          out.push({
            kind: 'heatmap',
            title: t('chart_heatmap'),
            cells: s.perDay.map((d) => ({
              day: d.day,
              value: d.settled > 0 ? d.rate : null,
              detail: d.settled > 0 ? `${d.settled - d.absent}/${d.settled}` : undefined,
            })),
            firstWeekday: new Date(Date.UTC(input.year, input.month - 1, 1)).getUTCDay(),
            weekdays: input.weekdays,
            color: CHART_COLORS.branch,
          });
        }
        break;
      case 'stacked': {
        const rows = input.branches
          .map((b) => {
            const st = s.perBranchStatus.find((x) => x.branch_id === b.id);
            return { label: b.name, present: st?.present ?? 0, late: st?.late ?? 0, absent: st?.absent ?? 0 };
          })
          .filter((r) => r.present + r.late + r.absent > 0)
          .map((r) => ({
            label: r.label,
            segments: [
              { label: t('present'), value: r.present, color: CHART_COLORS.present, mark: STATUS_STYLE.present.mark },
              { label: t('late'), value: r.late, color: CHART_COLORS.late, mark: STATUS_STYLE.late.mark },
              { label: t('absent'), value: r.absent, color: CHART_COLORS.absent, mark: STATUS_STYLE.absent.mark },
            ],
          }));
        if (rows.length) {
          out.push({ kind: 'stacked', title: t('chart_stacked'), rows, legend: statusItems(s, t, false) });
        }
        break;
      }
      case 'radar':
      case 'branch': {
        // A radar of branches is a magnitude per branch; bars carry that
        // without asking the reader to compare angles.
        const items = perSeries(input.branches, s.perBranch, (v) => v.branch_id, CHART_COLORS.branch);
        if (items.length) out.push({ kind: 'bars', title: panel === 'radar' ? t('chart_radar') : t('by_branch'), items });
        break;
      }
      case 'group': {
        const items = perSeries(input.groups, s.perGroup, (v) => v.group_id, CHART_COLORS.group);
        if (items.length) out.push({ kind: 'bars', title: t('by_group'), items });
        break;
      }
      case 'shift': {
        const items = perSeries(input.shifts, s.perShift, (v) => v.shift_id, CHART_COLORS.shift);
        if (items.length) out.push({ kind: 'bars', title: t('by_shift'), items });
        break;
      }
    }
  }
  return out;
}
