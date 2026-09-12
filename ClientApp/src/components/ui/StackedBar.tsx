export interface StackSegment {
  value: number;
  color: string;
  label: string; // for the tooltip/legend
}
export interface StackRow {
  label: string;
  segments: StackSegment[];
}

/**
 * Horizontal 100%-ish stacked bars — one row per category, each split into
 * status segments (e.g. present / late / absent). Identity comes from the shared
 * legend (label + colour), and each segment carries a hover tooltip. A 2px
 * surface gap separates adjacent segments per the mark spec.
 */
export default function StackedBar({
  rows,
  legend,
}: {
  rows: StackRow[];
  legend: { label: string; color: string }[];
}) {
  return (
    <div className="ui-stack" style={{ gap: 12 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {legend.map((l) => (
          <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
      {rows.map((r) => {
        const total = r.segments.reduce((a, s) => a + s.value, 0) || 1;
        return (
          <div key={r.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 5 }}>
              <span>{r.label}</span>
              <span className="ltr-nums ui-muted">{total}</span>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 2,
                height: 16,
                borderRadius: 6,
                overflow: 'hidden',
                background: 'var(--app-hairline)',
              }}
            >
              {r.segments.map((s, i) =>
                s.value > 0 ? (
                  <div
                    key={i}
                    title={`${s.label}: ${s.value}`}
                    style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
                  />
                ) : null,
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
