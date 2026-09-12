import type { ReactNode } from 'react';
import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { refreshOutline, warningOutline } from 'ionicons/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSettings } from '../lib/api/settings';
import { qk } from '../lib/api/keys';
import LoadingScreen from './LoadingScreen';

/** The app relies on the global settings for every gate (thresholds, windows,
 *  bypasses). If they can't be loaded it must NOT run with silent defaults —
 *  this blocks the app until settings load, with a retry. */
export default function SettingsGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: qk.settings,
    queryFn: getSettings,
    retry: 2,
  });

  if (isLoading) return <LoadingScreen />;

  if (isError || data == null) {
    return (
      <div className="server-down">
        <IonIcon icon={warningOutline} className="server-down__icon" />
        <h2 className="server-down__title">{t('settingsGate.title')}</h2>
        <p className="server-down__subtitle">{t('settingsGate.subtitle')}</p>
        <IonButton onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? (
            <IonSpinner name="crescent" />
          ) : (
            <>
              <IonIcon icon={refreshOutline} slot="start" />
              {t('serverDown.retry')}
            </>
          )}
        </IonButton>
      </div>
    );
  }

  return <>{children}</>;
}
