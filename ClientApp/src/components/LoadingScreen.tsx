import { IonContent, IonPage, IonSpinner } from '@ionic/react';

export default function LoadingScreen() {
  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IonSpinner name="crescent" />
        </div>
      </IonContent>
    </IonPage>
  );
}
