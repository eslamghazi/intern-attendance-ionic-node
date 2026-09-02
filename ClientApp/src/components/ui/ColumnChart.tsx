export interface ColumnItem {
  label: string;
  value: number;
}

/**
 * Vertical column chart (single hue = magnitude) with the value above each bar
 * and the category below. A different shape from the horizontal BarMeter, for
 * category breakdowns (by branch / group / shift).
 */
export default function ColumnChart({ items, color }: { items: ColumnItem[]; color?: string }) {
  const W = 360;
  const H = 180;
  const padT = 16;
  const padB = 34;
  const padX = 8;
  const plotH = H - padT - padB;
  const n = Math.max(1, items.length);
  const slot = (W - padX * 2) / n;
  const barW = Math.min(46, Math.max(10, slot - 14));
  const max = Math.max(1, ...items.map((i) => i.value));
  const fill = color ?? 'var(--ion-color-primary)';
  const baseY = padT + plotH;

  const clip = (s: string, max = 10) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img">
        <line x1={padX} x2={W - padX} y1={baseY} y2={baseY} stroke="var(--app-hairline)" strokeWidth={1} />
        {items.map((it, i) => {
          const x = padX + i * slot + slot / 2;
          const h = (it.value / max) * plotH;
          const y = baseY - h;
          return (
            <g key={i}>
              <rect x={x - barW / 2} y={y} width={barW} height={Math.max(0, h)} rx={4} fill={fill}>
                <title>{`${it.label}: ${it.value}`}</title>
              </rect>
              <text x={x} y={y - 5} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ion-text-color, #1a1a1a)">
                {it.value}
              </text>
              <text x={x} y={H - 18} textAnchor="middle" fontSize={9} fill="var(--ion-color-medium)">
                {clip(it.label)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
