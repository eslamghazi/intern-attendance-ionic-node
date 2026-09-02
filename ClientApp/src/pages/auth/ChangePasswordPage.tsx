import { useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonList,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { setInitialPassword } from '../../lib/api/auth';
import { markPasswordChanged } from '../../lib/api/profile';
import { TOAST_MS } from '../../lib/config';
import { useAuth } from '../../lib/auth/AuthContext';
import { useConfirmSignOut } from '../../lib/auth/useConfirmSignOut';

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const confirmSignOut = useConfirmSignOut();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [present] = useIonToast();

  const submit = async () => {
    if (pw.length < 6) return present({ message: t('auth.passwordTooShort'), duration: TOAST_MS.medium, color: 'danger' });
    if (pw !== confirm) return present({ message: t('auth.passwordsDontMatch'), duration: TOAST_MS.medium, color: 'danger' });

    setBusy(true);
    try {
      await setInitialPassword(pw);
      await markPasswordChanged();
      await refresh();
      present({ message: t('auth.passwordChanged'), duration: TOAST_MS.short, color: 'success' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('change-password failed:', e);
      present({ message: msg || t('common.error'), duration: TOAST_MS.long, color: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>{t('auth.mustChangeTitle')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => void confirmSignOut()}>{t('common.logout')}</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <IonText color="medium">
            <p>{t('auth.mustChangeHint')}</p>
          </IonText>
          <IonList inset>
            <IonItem>
              <IonInput fill="outline"
                label={t('auth.newPassword')}
                labelPlacement="stacked"
                type="password"
                value={pw}
                onIonInput={(e) => setPw(e.detail.value ?? '')}
              >
                <IonInputPasswordToggle slot="end" />
              </IonInput>
            </IonItem>
            <IonItem>
              <IonInput fill="outline"
                label={t('auth.confirmPassword')}
                labelPlacement="stacked"
                type="password"
                value={confirm}
                onIonInput={(e) => setConfirm(e.detail.value ?? '')}
              >
                <IonInputPasswordToggle slot="end" />
              </IonInput>
            </IonItem>
          </IonList>
          <IonButton expand="block" onClick={submit} disabled={busy || !pw || !confirm}>
            {t('common.save')}
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
}
