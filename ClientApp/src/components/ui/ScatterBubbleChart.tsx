// Scatter / bubble chart on an X/Y grid. Points carry an optional `r` (a raw
// magnitude) — when present the dot is sized by it (bubble), else it's a plain
// scatter dot.
export default function ScatterBubbleChart({
  points,
  xMax,
  yMax = 100,
  color = '#0d9488',
  ySuffix = '%',
  w = 380,
  h = 220,
}: {
  points: { x: number; y: number; r?: number }[];
  xMax: number;
  yMax?: number;
  color?: string;
  ySuffix?: string;
  w?: number;
  h?: number;
}) {
  if (!points.length) return null;
  const PAD_L = 34;
  const PAD_B = 22;
  const PAD_T = 10;
  const PAD_R = 12;
  const plotW = w - PAD_L - PAD_R;
  const plotH = h - PAD_T - PAD_B;
  const sx = (x: number) => PAD_L + (x / Math.max(1, xMax)) * plotW;
  const sy = (y: number) => PAD_T + plotH - (y / Math.max(1, yMax)) * plotH;
  const maxR = Math.max(1, ...points.map((p) => p.r ?? 0));
  const dotR = (p: { r?: number }) => (p.r != null ? 4 + (p.r / maxR) * 12 : 3.5);

  const yTicks = [0, yMax / 2, yMax];
  const xTicks = [1, Math.round(xMax / 2), xMax];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: 'block' }}>
      {/* y grid + labels */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD_L} y1={sy(v)} x2={w - PAD_R} y2={sy(v)} stroke="#eef2f7" strokeWidth={1} />
          <text x={PAD_L - 6} y={sy(v)} fontSize={9} textAnchor="end" dominantBaseline="middle" fill="#94a3b8">
            {Math.round(v)}
            {ySuffix}
          </text>
        </g>
      ))}
      {/* x axis + ticks */}
      <line x1={PAD_L} y1={sy(0)} x2={w - PAD_R} y2={sy(0)} stroke="#cbd5e1" strokeWidth={1} />
      {xTicks.map((v, i) => (
        <text key={i} x={sx(v)} y={h - 6} fontSize={9} textAnchor="middle" fill="#94a3b8">
          {v}
        </text>
      ))}
      {/* points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={sx(p.x)}
          cy={sy(p.y)}
          r={dotR(p)}
          fill={color}
          fillOpacity={p.r != null ? 0.45 : 0.85}
          stroke={color}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}
