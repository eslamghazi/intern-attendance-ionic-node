import {
  IonBackButton,
  IonButtons,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { ReactNode } from 'react';

export default function AdminHeader({
  title,
  children,
  backHref,
}: {
  title: string;
  children?: ReactNode;
  /** When set, show a back button (to this href) instead of the menu button. */
  backHref?: string;
}) {
  return (
    <IonHeader>
      <IonToolbar color="primary">
        <IonButtons slot="start">
          {backHref ? <IonBackButton defaultHref={backHref} /> : <IonMenuButton />}
        </IonButtons>
        <IonTitle>{title}</IonTitle>
        {children && <IonButtons slot="end">{children}</IonButtons>}
      </IonToolbar>
    </IonHeader>
  );
}
