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
  IonModal,
  IonTitle,
  IonToolbar,
  useIonLoading,
  useIonToast,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { TOAST_MS } from '../lib/config';
import { changePassword } from '../lib/api/auth';

export default function ChangePasswordModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // The current password is now required. GoTrue's updateUser() did not ask for
  // it, so anyone holding an unlocked phone could change the password and take
  // the account over; a voluntary change has to prove who is asking.
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [present] = useIonToast();
  const [showLoading, dismissLoading] = useIonLoading();

  const submit = async () => {
    if (pw.length < 6) {
      return present({ message: t('auth.passwordTooShort'), duration: TOAST_MS.medium, color: 'danger' });
    }
    if (pw !== confirm) {
      return present({ message: t('auth.passwordsDontMatch'), duration: TOAST_MS.medium, color: 'danger' });
    }
    await showLoading({ message: t('common.loading') });
    try {
      await changePassword(current, pw);
    } catch {
      await dismissLoading();
      return present({ message: t('common.error'), duration: TOAST_MS.medium, color: 'danger' });
    }
    await dismissLoading();
    present({ message: t('auth.passwordChanged'), duration: TOAST_MS.short, color: 'success' });
    setCurrent('');
    setPw('');
    setConfirm('');
    onClose();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>{t('auth.changePassword')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>{t('common.cancel')}</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonList inset>
          <IonItem>
            <IonInput fill="outline"
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
        <IonButton expand="block" onClick={submit} disabled={!current || !pw || !confirm}>
          {t('common.save')}
        </IonButton>
      </IonContent>
    </IonModal>
  );
}
