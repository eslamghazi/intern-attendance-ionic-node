import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react';
import { copyOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';

export interface DetailRow {
  label: string;
  value: string | null | undefined;
}

/** Read-only details popup: each field shows its value with a per-field copy button. */
export default function DetailsModal({
  isOpen,
  title,
  rows,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  rows: DetailRow[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [present] = useIonToast();

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      present({ message: t('common.copied'), duration: 1200, color: 'success' });
    } catch {
      present({ message: t('common.error'), duration: 1200, color: 'danger' });
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} initialBreakpoint={0.7} breakpoints={[0, 0.7, 1]}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>{t('common.close')}</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          {rows
            .filter((r) => r.value != null && String(r.value).trim() !== '')
            .map((r, i) => (
              <IonItem key={i}>
                <IonLabel className="ion-text-wrap">
                  <IonNote>{r.label}</IonNote>
                  <div style={{ unicodeBidi: 'plaintext' }}>{r.value}</div>
                </IonLabel>
                <IonButton
                  slot="end"
                  fill="clear"
                  onClick={() => copy(String(r.value))}
                  title={t('common.copy')}
                >
                  <IonIcon slot="icon-only" icon={copyOutline} />
                </IonButton>
              </IonItem>
            ))}
        </IonList>
      </IonContent>
    </IonModal>
  );
}
