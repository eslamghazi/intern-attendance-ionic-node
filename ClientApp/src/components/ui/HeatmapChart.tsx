import type { DayStat } from '../../lib/api/attendance';

/**
 * Month calendar heat-map: one cell per day laid out in weeks, shaded by that
 * day's attendance rate (light → deep green). Days with no data show as an empty
 * outline. A single sequential hue (magnitude), with a small scale key.
 */
export default function HeatmapChart({
  data,
  firstWeekday = 0,
  weekdays,
  todayDay,
}: {
  data: DayStat[];
  firstWeekday?: number; // 0=Sun … 6=Sat, weekday of day 1
  weekdays: string[]; // 7 short labels (localized), Sun-first
  todayDay?: number;
}) {
  const shade = (d: DayStat) => {
    if (d.attended + d.absent === 0) return 'transparent';
    const a = 0.16 + 0.84 * (d.rate / 100);
    return `rgba(22,163,74,${a.toFixed(3)})`; // present green ramp
  };
  const cells: (DayStat | null)[] = [...Array(firstWeekday).fill(null), ...data];
  const scale = [10, 40, 70, 100];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {weekdays.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 9, color: 'var(--ion-color-medium)' }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((d, i) =>
          d ? (
            <div
              key={i}
              title={d.attended + d.absent > 0 ? `${d.day} · ${d.rate}% (${d.attended}/${d.attended + d.absent})` : `${d.day}`}
              style={{
                aspectRatio: '1 / 1',
                borderRadius: 6,
                background: shade(d),
                border:
                  d.day === todayDay
                    ? '2px solid var(--ion-color-primary)'
                    : '1px solid var(--app-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 600,
                color: d.rate >= 55 ? '#fff' : 'var(--ion-color-medium)',
              }}
            >
              {d.day}
            </div>
          ) : (
            <div key={i} />
          ),
        )}
      </div>
      {/* scale key: low → high */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: '0.78rem', color: 'var(--ion-color-medium)' }}>
        <span>0%</span>
        {scale.map((s) => (
          <span key={s} style={{ width: 16, height: 12, borderRadius: 3, background: `rgba(22,163,74,${(0.16 + 0.84 * (s / 100)).toFixed(3)})` }} />
        ))}
        <span>100%</span>
      </div>
    </div>
  );
}
