import { IonIcon, useIonToast } from '@ionic/react';
import { copyOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';

/** Small "<label>: … 📋" line that copies the value to the clipboard on tap. */
export default function CopyId({ id, label = 'ID' }: { id: string; label?: string }) {
  const { t } = useTranslation();
  const [present] = useIonToast();
  const copy = async (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      present({ message: t('common.copied'), duration: 1000, color: 'success' });
    } catch {
      present({ message: t('common.error'), duration: 1000, color: 'danger' });
    }
  };
  return (
    <span
      onClick={copy}
      className="ui-caption ltr-nums"
      title={t('common.copy')}
      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, opacity: 0.75 }}
    >
      {label}: {id}
      <IonIcon icon={copyOutline} style={{ fontSize: 13 }} />
    </span>
  );
}
