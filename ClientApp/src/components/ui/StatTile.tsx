import { IonIcon } from '@ionic/react';

export default function StatTile({
  icon,
  value,
  label,
  color,
}: {
  icon?: string;
  value: number | string;
  label: string;
  color?: string;
}) {
  return (
    <div className="ui-surface" style={{ flex: 1, padding: 14, textAlign: 'center' }}>
      {icon && (
        <IonIcon icon={icon} style={{ fontSize: 20, color: color ?? 'var(--ion-color-primary)' }} />
      )}
      <div className="ui-value" style={{ color, marginTop: icon ? 4 : 0 }}>
        {value}
      </div>
      <div className="ui-caption" style={{ marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}
