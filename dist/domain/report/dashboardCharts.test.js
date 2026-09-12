import { describe, expect, it } from 'vitest';
import { dashboardCharts, parsePanels } from './dashboardCharts.js';
const stats = {
    attended: 40,
    late: 8,
    absent: 12,
    pending: 3,
    attendedOpen: 2,
    attendedSettled: 38,
    present: 32,
    settled: 50,
    rateBasis: 'settled',
    rate: 76,
    perBranch: [
        { branch_id: 'b1', value: 30 },
        { branch_id: 'b2', value: 10 },
    ],
    perGroup: [{ group_id: 'g1', value: 40 }],
    perShift: [],
    perBranchStatus: [
        { branch_id: 'b1', present: 24, late: 6, absent: 8 },
        { branch_id: 'b2', present: 8, late: 2, absent: 4 },
    ],
    perDay: [
        { day: 1, attended: 10, absent: 2, pending: 0, settled: 12, open: 0, rate: 83 },
        { day: 2, attended: 0, absent: 0, pending: 0, settled: 0, open: 0, rate: 0 },
        { day: 3, attended: 5, absent: 5, pending: 1, settled: 10, open: 1, rate: 50 },
    ],
};
const input = {
    stats,
    branches: [
        { id: 'b1', name: 'المبرة' },
        { id: 'b2', name: 'الجامعي' },
        { id: 'b3', name: 'غير مرئي' },
    ],
    groups: [{ id: 'g1', name: 'دفعة 2026' }],
    shifts: [{ id: 's1', name: 'صباحي' }],
    year: 2026,
    month: 9,
    weekdays: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
    t: (k) => k,
};
describe('parsePanels', () => {
    it('keeps known panels in the order given, once each', () => {
        expect(parsePanels('branch,donut,branch, gauge ,bogus')).toEqual(['branch', 'donut', 'gauge']);
    });
    it('is empty for nothing', () => {
        expect(parsePanels(undefined)).toEqual([]);
        expect(parsePanels('')).toEqual([]);
    });
});
describe('dashboardCharts', () => {
    it('draws nothing when nothing was picked', () => {
        expect(dashboardCharts([], input)).toEqual([]);
    });
    it('the donut carries the four statuses, the glyphs, and the rate in the middle', () => {
        const [donut] = dashboardCharts(['donut'], input);
        expect(donut).toMatchObject({ kind: 'donut', centerTop: '76%' });
        if (donut?.kind !== 'donut')
            throw new Error('not a donut');
        expect(donut.items.map((i) => [i.label, i.value, i.mark])).toEqual([
            ['present', 32, '✓'],
            ['late', 8, '!'],
            ['absent', 12, '✗'],
            ['still_open', 3, '·'],
        ]);
    });
    it('a rate with no basis shows a dash, not 0%', () => {
        const [donut] = dashboardCharts(['donut'], { ...input, stats: { ...stats, rateBasis: 'none' } });
        expect(donut).toMatchObject({ centerTop: '—' });
    });
    it('per-branch bars name only the branches that scored — a branch outside the caller’s reach is not listed', () => {
        const [bars] = dashboardCharts(['branch'], input);
        if (bars?.kind !== 'bars')
            throw new Error('not bars');
        expect(bars.items.map((i) => i.label)).toEqual(['المبرة', 'الجامعي']);
    });
    it('a series with no scores draws no chart at all', () => {
        expect(dashboardCharts(['shift'], input)).toEqual([]);
    });
    it('the daily forms follow the month, and a day with nothing settled is a gap, not a 0%', () => {
        const [cols, line] = dashboardCharts(['trendBar', 'trendLine'], input);
        expect(cols?.kind).toBe('columns');
        expect(line?.kind).toBe('line');
        if (cols?.kind !== 'columns')
            throw new Error();
        expect(cols.items.map((i) => i.value)).toEqual([83, 0, 50]);
        expect(cols.items.map((i) => i.gap ?? false)).toEqual([false, true, false]);
        expect(cols.yMax).toBe(100);
    });
    it('the daily forms are absent for a single day, which has no trend', () => {
        const single = { ...input, stats: { ...stats, perDay: [] } };
        expect(dashboardCharts(['trendBar', 'trendLine', 'heatmap', 'bubble', 'scatter'], single)).toEqual([]);
    });
    it('the calendar starts on the right weekday and leaves an unsettled day blank', () => {
        const [heat] = dashboardCharts(['heatmap'], input);
        if (heat?.kind !== 'heatmap')
            throw new Error('not a heatmap');
        // 1 September 2026 is a Tuesday.
        expect(heat.firstWeekday).toBe(2);
        expect(heat.cells.map((c) => c.value)).toEqual([83, null, 50]);
        expect(heat.cells[0]?.detail).toBe('10/12');
    });
    it('the stacked bar splits each branch by status with the glyphs on the segments', () => {
        const [stacked] = dashboardCharts(['stacked'], input);
        if (stacked?.kind !== 'stacked')
            throw new Error('not stacked');
        expect(stacked.rows.map((r) => r.label)).toEqual(['المبرة', 'الجامعي']);
        expect(stacked.rows[0]?.segments.map((s) => s.value)).toEqual([24, 6, 8]);
        expect(stacked.legend).toHaveLength(3);
    });
    it('forms the page cannot print take the nearest one under the panel’s own title', () => {
        const charts = dashboardCharts(['radar', 'polar', 'bubble', 'scatter', 'statusPie'], input);
        expect(charts.map((c) => [c.kind, c.title])).toEqual([
            ['bars', 'chart_radar'],
            ['donut', 'chart_polar'],
            ['columns', 'chart_bubble'],
            ['columns', 'chart_scatter'],
            ['donut', 'chart_status_pie'],
        ]);
    });
    it('keeps the order the screen showed them in', () => {
        const kinds = dashboardCharts(['group', 'gauge', 'donut'], input).map((c) => c.kind);
        expect(kinds).toEqual(['bars', 'gauge', 'donut']);
    });
});
//# sourceMappingURL=dashboardCharts.test.js.map