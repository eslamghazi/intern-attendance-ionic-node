import { IonItem, IonLabel, IonList, IonSkeletonText } from '@ionic/react';

export default function ListSkeleton({ rows = 6, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <IonList>
      {Array.from({ length: rows }).map((_, i) => (
        <IonItem key={i}>
          {avatar && (
            <IonSkeletonText
              animated
              style={{ width: 36, height: 36, borderRadius: '50%', marginInlineEnd: 12 }}
            />
          )}
          <IonLabel>
            <h3>
              <IonSkeletonText animated style={{ width: '55%' }} />
            </h3>
            <p>
              <IonSkeletonText animated style={{ width: '35%' }} />
            </p>
          </IonLabel>
        </IonItem>
      ))}
    </IonList>
  );
}
