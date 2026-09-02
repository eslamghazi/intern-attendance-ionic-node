import { useTranslation } from 'react-i18next';
import type { AttendanceStatus } from '../lib/types';
import { STATUS_COLOR } from '../lib/colors';

// Re-exported for existing imports (`import { STATUS_COLOR } from '../StatusBadge'`).
export { STATUS_COLOR };

export default function StatusBadge({
  status,
  label,
}: {
  status: AttendanceStatus | 'pending';
  /** Overrides the status wording — a shift that has not happened YET is
   *  "upcoming", not "has not shown up", even though both are pending. */
  label?: string;
}) {
  const { t } = useTranslation();
  const s = STATUS_COLOR[status] ?? {
    bg: 'var(--app-hairline)',
    fg: 'var(--ion-color-medium)',
    solid: 'var(--ion-color-medium)',
  };
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: '0.74rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label ?? t(`attendance.${status}`)}
    </span>
  );
}
