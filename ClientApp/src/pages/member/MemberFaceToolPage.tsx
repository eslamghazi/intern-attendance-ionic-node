import { useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSpinner,
  IonText,
  useIonAlert,
} from '@ionic/react';
import { checkmarkCircle, closeCircle, searchOutline, trashOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import MemberHeader from '../../components/MemberHeader';
import { faceLookup, faceReset, type FaceLookupResult } from '../../lib/api/faceTool';
import { useFeedback } from '../../components/ui/useFeedback';
import CopyId from '../../components/ui/CopyId';

/** Privileged-member tool: look a student up by national ID, see the name +
 *  whether a face is enrolled, and delete that face. */
export default function MemberFaceToolPage() {
  const { t } = useTranslation();
  const fb = useFeedback();
  const [presentAlert] = useIonAlert();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FaceLookupResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  const lookup = async () => {
    const q = code.trim();
    if (!q) return;
    setBusy(true);
    setResult(null);
    setNotFound(false);
    try {
      const res = await faceLookup(q);
      if (res.found) setResult(res);
      else setNotFound(true);
    } catch {
      fb.toast(t('common.error'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!result?.member_id) return;
    presentAlert({
      header: t('faceTool.deleteTitle'),
      message: t('faceTool.deleteBody', { name: result.full_name }),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('common.delete'),
          role: 'destructive',
          handler: async () => {
            setBusy(true);
            try {
              await faceReset(result.member_id!);
              fb.toast(t('faceTool.deleted'), 'success');
              setResult({ ...result, enrolled: false });
            } catch {
              fb.toast(t('common.error'), 'danger');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    });
  };

  return (
    <IonPage>
      <MemberHeader title={t('faceTool.title')} />
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <IonText color="medium">
            <p className="ui-caption">{t('faceTool.hint')}</p>
          </IonText>

          <IonItem>
            <IonInput
              label={t('admin.memberCode')}
              labelPlacement="stacked"
              inputmode="numeric"
              value={code}
              onIonInput={(e) => setCode(e.detail.value ?? '')}
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
            />
          </IonItem>
          <IonButton expand="block" className="ion-margin-top" onClick={lookup} disabled={busy || !code.trim()}>
            {busy ? <IonSpinner name="crescent" /> : <IonIcon slot="start" icon={searchOutline} />}
            {t('faceTool.search')}
          </IonButton>

          {notFound && (
            <IonText color="warning" className="ion-margin-top" style={{ display: 'block', textAlign: 'center' }}>
              <p>{t('faceTool.notFound')}</p>
            </IonText>
          )}

          {result?.found && (
            <div className="ui-surface" style={{ padding: 16, borderRadius: 12, marginTop: 16 }}>
              <IonLabel>
                <h2 style={{ margin: 0 }}>{result.full_name}</h2>
                {result.member_code && (
                  <div style={{ marginTop: 2 }}>
                    <CopyId id={result.member_code} label={t('admin.memberCode')} />
                  </div>
                )}
              </IonLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <IonIcon
                  icon={result.enrolled ? checkmarkCircle : closeCircle}
                  color={result.enrolled ? 'success' : 'medium'}
                  style={{ fontSize: 22 }}
                />
                <IonBadge color={result.enrolled ? 'success' : 'medium'}>
                  {result.enrolled ? t('faceTool.enrolled') : t('faceTool.notEnrolled')}
                </IonBadge>
              </div>
              {result.enrolled && (
                <IonButton expand="block" color="danger" className="ion-margin-top" onClick={remove} disabled={busy}>
                  <IonIcon slot="start" icon={trashOutline} />
                  {t('faceTool.deleteFace')}
                </IonButton>
              )}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
