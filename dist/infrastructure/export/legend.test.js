import { describe, it, expect } from 'vitest';
import { buildLegend, legendRows } from './legend.js';
import { ATTENDANCE_OUTCOME, OUTCOME_LEGEND_ORDER } from '../../config/constants.js';
/** Stands in for the i18n service: returns the key so it is visible in output. */
const t = (key) => `t(${key})`;
describe('buildLegend', () => {
    it('explains every outcome, in the declared order', () => {
        const legend = buildLegend(t);
        expect(legend).toHaveLength(OUTCOME_LEGEND_ORDER.length);
        expect(legend.map((e) => e.mark)).toEqual(OUTCOME_LEGEND_ORDER.map((k) => ATTENDANCE_OUTCOME[k].mark));
    });
    it('translates the label rather than hard-coding it', () => {
        // The legend has to read in the language the report was asked for.
        expect(buildLegend(t)[0].label).toMatch(/^t\(outcome\./);
    });
});
describe('legendRows', () => {
    it('pads every row to the table width, so the sheet stays one table', () => {
        const { rows } = legendRows(t, 5);
        for (const row of rows)
            expect(row).toHaveLength(5);
    });
    it('opens with a blank row and a heading, then one row per outcome', () => {
        const { rows } = legendRows(t, 3);
        expect(rows[0]).toEqual(['', '', '']);
        expect(rows[1][0]).toBe('t(report.legend)');
        expect(rows).toHaveLength(2 + OUTCOME_LEGEND_ORDER.length);
    });
    it('colours the MARK cell only — a whole coloured row reads as data', () => {
        const { rows, colors } = legendRows(t, 3);
        const firstEntry = 2;
        expect(colors[firstEntry][0]).toMatch(/^#[0-9a-f]{6}$/i);
        expect(colors[firstEntry][1]).toBeUndefined();
        // and the label sits beside it, readable
        expect(rows[firstEntry][1]).toMatch(/^t\(outcome\./);
    });
    it('lines its colours up with its rows, so nothing paints the wrong cell', () => {
        const { rows, colors } = legendRows(t, 4);
        expect(colors).toHaveLength(rows.length);
    });
});
//# sourceMappingURL=legend.test.js.map