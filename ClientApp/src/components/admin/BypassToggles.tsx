import { IonItem, IonLabel, IonToggle } from '@ionic/react';
import { useTranslation } from 'react-i18next';

/** Face + location bypass toggles, reused on the member / branch / group forms. */
export default function BypassToggles({
  face,
  location,
  onFace,
  onLocation,
}: {
  face: boolean;
  location: boolean;
  onFace: (v: boolean) => void;
  onLocation: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <IonItem>
        <IonLabel className="ion-text-wrap">{t('admin.bypassFace')}</IonLabel>
        <IonToggle checked={face} onIonChange={(e) => onFace(e.detail.checked)} />
      </IonItem>
      <IonItem>
        <IonLabel className="ion-text-wrap">{t('admin.bypassLocation')}</IonLabel>
        <IonToggle checked={location} onIonChange={(e) => onLocation(e.detail.checked)} />
      </IonItem>
    </>
  );
}
