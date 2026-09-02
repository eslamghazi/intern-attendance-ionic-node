/** QR image wrapped by a circular countdown ring that depletes as the current
 *  token nears expiry. Shared by the manager + member QR generators. */
export default function QrRing({
  url,
  secondsLeft,
  total,
}: {
  url: string;
  secondsLeft: number;
  total: number;
}) {
  const SIZE = 300;
  const STROKE = 9;
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;
  const pct = total > 0 ? Math.max(0, Math.min(1, secondsLeft / total)) : 0;
  const offset = C * (1 - pct);
  const color = secondsLeft <= 5 ? 'var(--ion-color-warning)' : 'var(--ion-color-primary)';
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: SIZE, aspectRatio: '1 / 1', margin: '0 auto' }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--ion-color-step-200, #e2e2e2)" strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <img
        src={url}
        alt="QR"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '64%',
          height: '64%',
          borderRadius: 8,
          background: '#fff',
          padding: 6,
        }}
      />
    </div>
  );
}
