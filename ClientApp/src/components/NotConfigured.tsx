import { IonContent, IonPage, IonText } from '@ionic/react';
import { useTranslation } from 'react-i18next';

export default function NotConfigured() {
  const { t } = useTranslation();
  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 480, margin: '15vh auto', textAlign: 'center' }}>
          <h2>{t('common.notConfiguredTitle')}</h2>
          <IonText color="medium">
            <p>{t('common.notConfiguredBody')}</p>
          </IonText>
          <pre
            style={{
              textAlign: 'left',
              background: 'rgba(128,128,128,0.16)',
              padding: 12,
              borderRadius: 8,
              direction: 'ltr',
            }}
          >
            VITE_API_URL=https://api.example.edu/api/v1
          </pre>
        </div>
      </IonContent>
    </IonPage>
  );
}
