import { STATUS_COLOR } from '../../lib/colors';
import type { DayStat } from '../../lib/api/attendance';

export type ChartType = 'bar' | 'line' | 'area';

/**
 * Daily attendance-rate trend for a month (rate 0–100% per day), rendered as
 * columns, a line, or a filled area — the admin picks. Baseline-anchored, single
 * status hue (today highlighted), recessive gridlines, and a per-point hover
 * tooltip. Change-over-time → columns/line/area.
 */
export default function TrendChart({
  data,
  todayDay,
  label,
  type = 'bar',
}: {
  data: DayStat[];
  todayDay?: number;
  label?: string;
  type?: ChartType;
}) {
  const W = 360;
  const H = 168;
  const padL = 26;
  const padR = 8;
  const padT = 10;
  const padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = Math.max(1, data.length);
  const slot = plotW / n;
  const baseY = padT + plotH;
  const green = STATUS_COLOR.present.solid;
  const yFor = (rate: number) => padT + plotH * (1 - rate / 100);
  const grid = [0, 50, 100];

  const pts = data.map((d, i) => ({
    d,
    has: d.attended + d.absent > 0,
    x: padL + i * slot + slot / 2,
    y: yFor(d.rate),
  }));
  const line = pts.filter((p) => p.has);
  const linePath = line.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    line.length > 1
      ? `${linePath} L ${line[line.length - 1].x} ${baseY} L ${line[0].x} ${baseY} Z`
      : '';

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label={label}>
        {grid.map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={yFor(g)} y2={yFor(g)} stroke="var(--app-hairline)" strokeWidth={1} />
            <text x={padL - 6} y={yFor(g) + 3} textAnchor="end" fontSize={9} fill="var(--ion-color-medium)">
              {g}
            </text>
          </g>
        ))}

        {/* Columns */}
        {type === 'bar' &&
          pts.map((p) => {
            const barW = Math.max(3, slot - 3);
            const isToday = p.d.day === todayDay;
            if (!p.has)
              return <rect key={p.d.day} x={p.x - barW / 2} y={baseY - 2} width={barW} height={2} rx={1} fill="var(--app-hairline)" />;
            return (
              <rect
                key={p.d.day}
                x={p.x - barW / 2}
                y={p.y}
                width={barW}
                height={Math.max(0, baseY - p.y)}
                rx={2}
                fill={isToday ? 'var(--ion-color-primary)' : green}
                opacity={isToday ? 1 : 0.85}
              >
                <title>{`${p.d.day} · ${p.d.rate}% (${p.d.attended}/${p.d.attended + p.d.absent})`}</title>
              </rect>
            );
          })}

        {/* Area fill */}
        {type === 'area' && areaPath && <path d={areaPath} fill={green} opacity={0.16} />}

        {/* Line (line + area) */}
        {(type === 'line' || type === 'area') && linePath && (
          <path d={linePath} fill="none" stroke={green} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {(type === 'line' || type === 'area') &&
          line.map((p) => (
            <circle
              key={p.d.day}
              cx={p.x}
              cy={p.y}
              r={p.d.day === todayDay ? 3.5 : 2.5}
              fill={p.d.day === todayDay ? 'var(--ion-color-primary)' : green}
            >
              <title>{`${p.d.day} · ${p.d.rate}% (${p.d.attended}/${p.d.attended + p.d.absent})`}</title>
            </circle>
          ))}

        {/* X labels (every 5th day + the 1st) */}
        {pts.map((p) =>
          p.d.day === 1 || p.d.day % 5 === 0 ? (
            <text key={`l${p.d.day}`} x={p.x} y={H - 6} textAnchor="middle" fontSize={9} fill="var(--ion-color-medium)">
              {p.d.day}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
