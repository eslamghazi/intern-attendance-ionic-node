import { useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonModal,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react';
import { copyOutline, flaskOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { randomDummyNationalId } from '../../lib/nationalId';
import { TOAST_MS } from '../../lib/config';

const MAX = 500;

/** Admin testing tool: generate valid, unique dummy national IDs (one per line).
 *  It does NOT touch the database — it only produces the numbers to copy/use. */
export default function GenerateDummyMembers() {
  const { t } = useTranslation();
  const [present] = useIonToast();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(10);
  const [ids, setIds] = useState<string[]>([]);

  const generate = () => {
    const n = Math.max(1, Math.min(MAX, Number(count) || 0));
    const set = new Set<string>();
    while (set.size < n) set.add(randomDummyNationalId());
    setIds([...set]);
  };

  const copyIds = async () => {
    try {
      await navigator.clipboard.writeText(ids.join('\n'));
      present({ message: t('common.copied'), duration: TOAST_MS.short, color: 'success' });
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <IonButton size="small" fill="outline" onClick={() => setOpen(true)}>
        <IonIcon slot="start" icon={flaskOutline} />
        {t('admin.generateDummy')}
      </IonButton>

      <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>{t('admin.generateDummy')}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setOpen(false)}>{t('common.close')}</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonText color="medium">
            <p style={{ fontSize: '0.9rem' }}>{t('admin.dummyHint')}</p>
          </IonText>

          <IonItem>
            <IonInput
              type="number"
              label={t('admin.dummyCount')}
              labelPlacement="stacked"
              fill="outline"
              className="input-fill-outline"
              value={count}
              min={1}
              max={MAX}
              onIonInput={(e) => setCount(Number(e.detail.value) || 0)}
            />
          </IonItem>

          <IonButton expand="block" className="ion-margin-top" onClick={generate}>
            {t('admin.generateDummy')}
          </IonButton>

          {ids.length > 0 && (
            <div className="ui-surface ui-section" style={{ padding: 12, marginTop: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <strong>
                  {t('admin.dummyGeneratedIds')} ({ids.length})
                </strong>
                <IonButton fill="clear" size="small" onClick={copyIds}>
                  <IonIcon slot="start" icon={copyOutline} />
                  {t('common.copy')}
                </IonButton>
              </div>
              <IonTextarea
                readonly
                autoGrow
                className="ltr-nums"
                value={ids.join('\n')}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem', textAlign: 'start' }}
              />
            </div>
          )}
        </IonContent>
      </IonModal>
    </>
  );
}
