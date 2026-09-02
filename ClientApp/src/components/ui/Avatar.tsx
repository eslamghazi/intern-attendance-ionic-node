function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function Avatar({
  name,
  src,
  size = 40,
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
}) {
  const base = {
    width: size,
    height: size,
    flex: `0 0 ${size}px`,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as const;

  if (src) {
    return (
      <div style={base}>
        <img
          src={src}
          alt={name ?? ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...base,
        fontWeight: 600,
        fontSize: size * 0.36,
        color: 'var(--ion-color-primary)',
        background: 'rgba(13,148,136,0.12)',
      }}
    >
      {initials(name)}
    </div>
  );
}
