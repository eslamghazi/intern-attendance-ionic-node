export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

/** Minimal flat horizontal bars (no chart library). */
export default function BarMeter({ items }: { items: BarItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="ui-stack">
      {items.map((it, i) => (
        <div key={i}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.85rem',
              marginBottom: 5,
            }}
          >
            <span>{it.label}</span>
            <span className="ltr-nums ui-muted">{it.value}</span>
          </div>
          <div style={{ height: 8, borderRadius: 6, background: 'var(--app-hairline)' }}>
            <div
              style={{
                width: `${(it.value / max) * 100}%`,
                height: '100%',
                borderRadius: 6,
                background: it.color ?? 'var(--ion-color-primary)',
                transition: 'width .3s ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
