import { useTranslation } from 'react-i18next';
import { STATUS_COLOR } from '../lib/colors';

// The statuses that appear as marks in the monthly grids, in a sensible order.
const STATUSES = ['present', 'late', 'early_leave', 'left_work', 'absent', 'pending'] as const;

/** A small key explaining what each status mark/colour in the grid means. */
export default function StatusLegend() {
  const { t } = useTranslation();
  return (
    <div className="status-legend">
      {STATUSES.map((s) => {
        const c = STATUS_COLOR[s];
        return (
          <span className="status-legend__item" key={s}>
            <span
              className="status-legend__mark"
              style={{ background: c.fill, color: c.fg, borderColor: c.solid }}
            >
              {c.mark}
            </span>
            <span className="ui-caption">{t(`attendance.${s}`)}</span>
          </span>
        );
      })}
    </div>
  );
}
