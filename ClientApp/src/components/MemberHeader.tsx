import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { logOutOutline } from 'ionicons/icons';
import { useConfirmSignOut } from '../lib/auth/useConfirmSignOut';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';

export default function MemberHeader({ title, backHref }: { title: string; backHref?: string }) {
  const confirmSignOut = useConfirmSignOut();
  return (
    <IonHeader>
      <IonToolbar color="primary">
        {backHref && (
          <IonButtons slot="start">
            <IonBackButton defaultHref={backHref} />
          </IonButtons>
        )}
        <IonTitle>{title}</IonTitle>
        <IonButtons slot="end">
          <ThemeToggle />
          <LanguageToggle />
          <IonButton onClick={() => void confirmSignOut()} aria-label="logout">
            <IonIcon slot="icon-only" icon={logOutOutline} />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
  );
}
