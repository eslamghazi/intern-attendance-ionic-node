import { ATTENDANCE_OUTCOME, OUTCOME_LEGEND_ORDER, } from '../../config/constants.js';
/** `t` translates the label key — the legend reads in the report's language. */
export function buildLegend(t) {
    return OUTCOME_LEGEND_ORDER.map((key) => ({
        mark: ATTENDANCE_OUTCOME[key].mark,
        fill: ATTENDANCE_OUTCOME[key].fill,
        label: t(ATTENDANCE_OUTCOME[key].labelKey),
    }));
}
/**
 * The legend as table rows, for a sheet that has no room for a second block.
 *
 * Two columns — the mark and what it means — appended under the data with a
 * blank row between, so the file stays one table and opens in anything.
 */
export function legendRows(t, width) {
    const entries = buildLegend(t);
    const pad = (cells) => {
        const row = [...cells];
        while (row.length < width)
            row.push('');
        return row;
    };
    const rows = [pad([]), pad([t('report.legend')])];
    const colors = [[], []];
    for (const e of entries) {
        rows.push(pad([e.mark, e.label]));
        // Only the mark cell is filled: the label must stay readable, and a whole
        // coloured row reads as data rather than as a key.
        colors.push([e.fill, undefined]);
    }
    return { rows, colors };
}
//# sourceMappingURL=legend.js.map