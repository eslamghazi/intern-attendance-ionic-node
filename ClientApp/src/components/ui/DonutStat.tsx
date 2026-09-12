export interface DonutSegment {
  value: number;
  color: string;
}

/** Minimal flat donut (SVG). Pass segments + optional center labels. */
export default function DonutStat({
  segments,
  size = 128,
  stroke = 12,
  centerTop,
  centerBottom,
}: {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
  centerTop?: string | number;
  centerBottom?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--app-hairline)"
        strokeWidth={stroke}
      />
      {segments.map((s, i) => {
        const len = (s.value / total) * c;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return el;
      })}
      {centerTop !== undefined && (
        <text
          x="50%"
          y={centerBottom ? '47%' : '52%'}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.24}
          fontWeight={700}
          fill="var(--ion-text-color, #1a1a1a)"
        >
          {centerTop}
        </text>
      )}
      {centerBottom && (
        <text
          x="50%"
          y="63%"
          textAnchor="middle"
          fontSize={size * 0.1}
          fill="var(--ion-color-medium)"
        >
          {centerBottom}
        </text>
      )}
    </svg>
  );
}
