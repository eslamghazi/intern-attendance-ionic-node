import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonList,
  IonPage,
  IonText,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { changeMemberPassword } from '../../lib/api/members';
import MemberHeader from '../../components/MemberHeader';
import { ROUTES } from '../../lib/routes';
import { useFeedback } from '../../components/ui/useFeedback';

export default function MemberChangePasswordPage() {
  const { t } = useTranslation();
  const fb = useFeedback();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (next.length < 6) return setError(t('auth.passwordTooShort'));
    if (next !== confirm) return setError(t('auth.passwordsDontMatch'));
    setBusy(true);
    try {
      await changeMemberPassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      await fb.run(() => Promise.resolve(true), { success: t('auth.passwordChanged') });
    } catch {
      setError(t('auth.wrongPassword'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <MemberHeader title={t('auth.changePassword')} backHref={ROUTES.member.profile} />
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <IonList inset>
            <IonItem>
              <IonInput
                fill="outline"
                label={t('auth.currentPassword')}
                labelPlacement="stacked"
                type="password"
                value={current}
                onIonInput={(e) => setCurrent(e.detail.value ?? '')}
              >
                <IonInputPasswordToggle slot="end" />
              </IonInput>
            </IonItem>
            <IonItem>
              <IonInput
                fill="outline"
                label={t('auth.newPassword')}
                labelPlacement="stacked"
                type="password"
                value={next}
                onIonInput={(e) => setNext(e.detail.value ?? '')}
              >
                <IonInputPasswordToggle slot="end" />
              </IonInput>
            </IonItem>
            <IonItem>
              <IonInput
                fill="outline"
                label={t('auth.confirmPassword')}
                labelPlacement="stacked"
                type="password"
                value={confirm}
                onIonInput={(e) => setConfirm(e.detail.value ?? '')}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              >
                <IonInputPasswordToggle slot="end" />
              </IonInput>
            </IonItem>
          </IonList>

          {error && (
            <IonText color="danger">
              <p style={{ textAlign: 'center' }}>{error}</p>
            </IonText>
          )}

          <IonButton
            expand="block"
            className="ion-margin-top"
            onClick={submit}
            disabled={busy || !current || !next || !confirm}
          >
            {t('auth.changePassword')}
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
}
