import { IonIcon } from '@ionic/react';

export default function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '52px 24px', color: 'var(--ion-color-medium)' }}>
      {icon && <IonIcon icon={icon} style={{ fontSize: 46, opacity: 0.45 }} />}
      <div style={{ marginTop: 12, fontWeight: 600 }}>{title}</div>
      {subtitle && <div style={{ marginTop: 4, fontSize: '0.85rem' }}>{subtitle}</div>}
    </div>
  );
}
