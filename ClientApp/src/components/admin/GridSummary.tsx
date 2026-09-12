import { IonChip, IonIcon, IonLabel } from '@ionic/react';
import {
  businessOutline,
  calendarClearOutline,
  gitBranchOutline,
  peopleOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';

const pad = (n: number) => String(n).padStart(2, '0');

/** A compact "what this table shows" header: active branch, month/year,
 *  department and the number of members currently displayed. */
export default function GridSummary({
  branchName,
  month,
  year,
  departmentName,
  showDepartment,
  count,
}: {
  branchName?: string | null;
  month: number;
  year: number;
  departmentName?: string | null;
  showDepartment?: boolean;
  count: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid-summary">
      <IonChip>
        <IonIcon icon={businessOutline} />
        <IonLabel>{branchName || t('common.all')}</IonLabel>
      </IonChip>
      <IonChip>
        <IonIcon icon={calendarClearOutline} />
        <IonLabel className="ltr-nums">
          {pad(month)}/{year}
        </IonLabel>
      </IonChip>
      {showDepartment && (
        <IonChip>
          <IonIcon icon={gitBranchOutline} />
          <IonLabel>{departmentName || t('common.all')}</IonLabel>
        </IonChip>
      )}
      <IonChip color="primary">
        <IonIcon icon={peopleOutline} />
        <IonLabel className="ltr-nums">
          {count} · {t('nav.members')}
        </IonLabel>
      </IonChip>
    </div>
  );
}
