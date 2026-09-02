export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * Full pie (solid slices, not a ring) with a labelled legend — a distinct shape
 * from the donut. Identity is carried by the legend (label + value), never by
 * colour alone. Use for a small reserved-colour set (e.g. present/late/absent).
 */
export default function PieChart({ slices, size = 140 }: { slices: PieSlice[]; size?: number }) {
  const data = slices.filter((s) => s.value > 0);
  const total = data.reduce((a, s) => a + s.value, 0);
  const r = size / 2;
  const cx = r;
  const cy = r;

  let angle = -Math.PI / 2; // start at 12 o'clock
  const paths = data.map((s) => {
    const frac = total > 0 ? s.value / total : 0;
    const start = angle;
    const end = angle + frac * 2 * Math.PI;
    angle = end;
    // A single non-zero slice would collapse to a point — draw the full circle.
    if (data.length === 1) {
      return { s, d: `M ${cx} ${cy} m ${-r} 0 a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0` };
    }
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    return { s, d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z` };
  });

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.s.color} stroke="var(--ion-background-color, #fff)" strokeWidth={2}>
            <title>{`${p.s.label}: ${p.s.value}`}</title>
          </path>
        ))}
      </svg>
      <div className="ui-stack" style={{ gap: 6 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span>{s.label}</span>
            <span className="ltr-nums ui-muted">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
