import { STATUS_COLOR } from '../../lib/colors';

/**
 * Semicircle "speedometer" gauge for a single 0–100% value (e.g. attendance
 * rate). A distinct shape from the donut: a half-ring that fills left→right,
 * colored by how healthy the rate is (green / amber / red bands).
 */
export default function GaugeChart({
  value,
  label,
}: {
  value: number; // 0..100
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const W = 200;
  const H = 118;
  const sw = 16;
  const R = 78;
  const cx = W / 2;
  const cy = H - 12;
  const arc = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  const color =
    v >= 75 ? STATUS_COLOR.present.solid : v >= 50 ? STATUS_COLOR.late.solid : STATUS_COLOR.absent.solid;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxWidth: 260, margin: '0 auto' }} role="img" aria-label={label}>
      {/* track */}
      <path d={arc} fill="none" stroke="var(--app-hairline)" strokeWidth={sw} strokeLinecap="round" />
      {/* value */}
      <path
        d={arc}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${v} 100`}
      />
      {/* end labels */}
      <text x={cx - R} y={cy + 14} textAnchor="middle" fontSize={9} fill="var(--ion-color-medium)">0</text>
      <text x={cx + R} y={cy + 14} textAnchor="middle" fontSize={9} fill="var(--ion-color-medium)">100</text>
      {/* center value */}
      <text x={cx} y={cy - 14} textAnchor="middle" fontSize={30} fontWeight={800} fill="var(--ion-text-color, #1a1a1a)">
        {v}%
      </text>
      {label && (
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={10} fill="var(--ion-color-medium)">
          {label}
        </text>
      )}
    </svg>
  );
}
