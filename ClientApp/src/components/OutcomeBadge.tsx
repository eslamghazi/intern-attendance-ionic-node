import { useTranslation } from 'react-i18next';
import { OUTCOME_ORDER, outcomeLabelKey, outcomeStyle, type OutcomeCode } from '../lib/outcome';

/**
 * One attendance outcome, shown as its mark and its words.
 *
 * BOTH, always. The mark alone is a puzzle the first time somebody sees it; the
 * words alone make a dense grid unreadable. Together the grid scans and the
 * individual row still says plainly "came in late, then left work".
 */
export default function OutcomeBadge({ outcome }: { outcome: OutcomeCode }) {
  const { t } = useTranslation();
  const s = outcomeStyle(outcome);

  return (
    <span
      className="outcome-badge"
      style={{ background: s.fill, color: s.fg }}
      title={t(outcomeLabelKey(outcome))}
    >
      <span className="outcome-badge__mark" aria-hidden="true">
        {s.mark}
      </span>
      {t(outcomeLabelKey(outcome))}
    </span>
  );
}

/**
 * The key to the marks.
 *
 * Generated from the same table that draws the badges, so it cannot describe a
 * mark nobody uses or miss one that is in use. Shown beside any screen that
 * uses the marks, and appended to every export for the same reason — a file
 * outlives the screen it came from.
 */
export function OutcomeLegend() {
  const { t } = useTranslation();

  return (
    <div className="outcome-legend">
      <div className="outcome-legend__title">{t('report.legend')}</div>
      <div className="outcome-legend__items">
        {OUTCOME_ORDER.map((key) => {
          const s = outcomeStyle(key);
          return (
            <span key={key} className="outcome-legend__item">
              <span
                className="outcome-legend__mark"
                style={{ background: s.fill, color: s.fg }}
                aria-hidden="true"
              >
                {s.mark}
              </span>
              {t(outcomeLabelKey(key))}
            </span>
          );
        })}
      </div>
    </div>
  );
}
