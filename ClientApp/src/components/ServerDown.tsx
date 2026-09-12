import { useEffect, useState } from 'react';
import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { cloudOfflineOutline, refreshOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { pingServer } from '../lib/serverStatus';
import { queryClient } from '../lib/queryClient';
import { TIMING } from '../lib/config';

const AUTO_RETRY_MS = TIMING.SERVER_RETRY_MS;

/**
 * Full-screen overlay shown whenever the API is unreachable (or
 * the device is offline). Auto-retries in the background and lets the user
 * retry manually; on recovery it refetches queries so the app catches up.
 */
export default function ServerDown() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await pingServer();
    if (ok) void queryClient.invalidateQueries();
    setBusy(false);
  };

  // Auto-retry so the app recovers on its own once the backend comes back.
  useEffect(() => {
    const id = window.setInterval(() => {
      void pingServer().then((ok) => {
        if (ok) void queryClient.invalidateQueries();
      });
    }, AUTO_RETRY_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="server-down">
      <IonIcon icon={cloudOfflineOutline} className="server-down__icon" />
      <h2 className="server-down__title">{t('serverDown.title')}</h2>
      <p className="server-down__subtitle">{t('serverDown.subtitle')}</p>
      <IonButton onClick={retry} disabled={busy}>
        {busy ? (
          <IonSpinner name="crescent" />
        ) : (
          <>
            <IonIcon icon={refreshOutline} slot="start" />
            {t('serverDown.retry')}
          </>
        )}
      </IonButton>
      {busy && <p className="server-down__hint">{t('serverDown.checking')}</p>}
    </div>
  );
}
