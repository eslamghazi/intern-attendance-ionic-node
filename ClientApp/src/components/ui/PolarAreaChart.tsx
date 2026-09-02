// Polar-area chart — equal-angle wedges whose RADIUS grows with the value
// (area ∝ value via a sqrt radius).
export default function PolarAreaChart({
  slices,
  size = 240,
}: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const n = slices.length;
  if (!n) return null;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 16;
  const max = Math.max(1, ...slices.map((s) => s.value));
  const seg = (2 * Math.PI) / n;
  const wedge = (i: number): string => {
    const r = R * Math.sqrt(slices[i].value / max);
    const a0 = -Math.PI / 2 + i * seg;
    const a1 = a0 + seg;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`;
  };

  return (
    <div>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size, display: 'block', margin: '0 auto' }}>
        {[0.33, 0.66, 1].map((rr, i) => (
          <circle key={i} cx={cx} cy={cy} r={R * rr} fill="none" stroke="#eef2f7" strokeWidth={1} />
        ))}
        {slices.map((s, i) => (
          <path key={i} d={wedge(i)} fill={s.color} fillOpacity={0.85} stroke="#ffffff" strokeWidth={1} />
        ))}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 8 }}>
        {slices.map((s) => (
          <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
            {s.label} · {s.value}
          </span>
        ))}
      </div>
    </div>
  );
}
