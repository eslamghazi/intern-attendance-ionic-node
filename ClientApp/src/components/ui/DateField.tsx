import { useState } from 'react';
import { IonDatetime, IonItem, IonLabel, IonModal } from '@ionic/react';
import { formatDate } from '../../lib/date';
import { appToday } from '../../lib/clock';

/** Date picker whose value always displays as dd/mm/yyyy (locale-independent),
 *  unlike the native <input type="date"> which follows the OS locale. */
export default function DateField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string; // yyyy-mm-dd
  onChange: (ymd: string) => void;
  /** Selectable bounds (yyyy). Default: 10 years back … 3 years ahead — otherwise
   *  IonDatetime caps navigation at the end of the current year. */
  min?: string;
  max?: string;
}) {
  const [open, setOpen] = useState(false);
  const curYear = Number(appToday().slice(0, 4));
  const minYear = min ?? `${curYear - 10}-01-01`;
  const maxYear = max ?? `${curYear + 3}-12-31`;

  return (
    <>
      <IonItem className="ui-field-item" button detail={false} onClick={() => setOpen(true)}>
        <IonLabel>
          <p className="ui-caption">{label}</p>
          <span className="ltr-nums" style={{ fontWeight: 600 }}>
            {formatDate(value)}
          </span>
        </IonLabel>
      </IonItem>
      <IonModal className="date-modal" isOpen={open} onDidDismiss={() => setOpen(false)}>
        <IonDatetime
          presentation="date"
          value={value || undefined}
          min={minYear}
          max={maxYear}
          firstDayOfWeek={6}
          onIonChange={(e) => {
            const v = e.detail.value;
            const ymd = (Array.isArray(v) ? v[0] : v)?.slice(0, 10);
            if (ymd) {
              onChange(ymd);
              setOpen(false);
            }
          }}
        />
      </IonModal>
    </>
  );
}
