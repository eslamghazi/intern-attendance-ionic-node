// Radar (spider) chart — compares one value across N categories (axes).
export default function RadarChart({
  items,
  color = '#0d9488',
  size = 260,
}: {
  items: { label: string; value: number }[];
  color?: string;
  size?: number;
}) {
  const n = items.length;
  if (n < 3) return null;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 40;
  const max = Math.max(1, ...items.map((i) => i.value));
  const pt = (i: number, r: number): [number, number] => {
    const ang = -Math.PI / 2 + (i / n) * 2 * Math.PI;
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  };
  const ringPoly = (rr: number) =>
    items.map((_, i) => pt(i, R * rr).join(',')).join(' ');
  const dataPoly = items.map((it, i) => pt(i, R * (it.value / max)).join(',')).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size, display: 'block', margin: '0 auto' }}>
      {[0.25, 0.5, 0.75, 1].map((rr, ri) => (
        <polygon key={ri} points={ringPoly(rr)} fill="none" stroke="#e2e8f0" strokeWidth={1} />
      ))}
      {items.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={1} />;
      })}
      <polygon points={dataPoly} fill={color} fillOpacity={0.28} stroke={color} strokeWidth={2} />
      {items.map((it, i) => {
        const [x, y] = pt(i, R * (it.value / max));
        return <circle key={i} cx={x} cy={y} r={3} fill={color} />;
      })}
      {items.map((it, i) => {
        const [x, y] = pt(i, R + 16);
        return (
          <text key={i} x={x} y={y} fontSize={10} textAnchor="middle" dominantBaseline="middle" fill="#475569">
            {it.label.length > 12 ? it.label.slice(0, 11) + '…' : it.label}
          </text>
        );
      })}
    </svg>
  );
}
