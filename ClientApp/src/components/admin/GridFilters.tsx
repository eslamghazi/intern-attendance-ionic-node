import { IonItem, IonSelect, IonSelectOption } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { SearchField } from '../../lib/api/members';
import { MONTHS } from '../../lib/config';
import { appToday } from '../../lib/clock';
import SearchBox from './SearchBox';


interface Props {
  month: number;
  year: number;
  branchId: string;
  branches: { id: string; name: string }[];
  field: SearchField;
  search: string;
  onMonth: (m: number) => void;
  onYear: (y: number) => void;
  onBranch: (id: string) => void;
  onField: (f: SearchField) => void;
  onSearch: (s: string) => void;
  // Optional department filter (shown only when departments are provided).
  departments?: { id: string; name: string }[];
  departmentId?: string;
  onDepartment?: (id: string) => void;
}

export default function GridFilters({
  month,
  year,
  branchId,
  branches,
  field,
  search,
  onMonth,
  onYear,
  onBranch,
  onField,
  onSearch,
  departments,
  departmentId = '',
  onDepartment,
}: Props) {
  const { t } = useTranslation();
  const base = Number(appToday().slice(0, 4));
  const years = [base - 3, base - 2, base - 1, base, base + 1];

  return (
    <div className="ui-surface ui-section" style={{ overflow: 'hidden' }}>
      <div className="grid-filter-row">
        <IonItem lines="none">
          <IonSelect
            label={t('rosters.month')}
            labelPlacement="stacked"
            interface="popover"
            value={month}
            onIonChange={(e) => onMonth(Number(e.detail.value))}
          >
            {MONTHS.map((m) => (
              <IonSelectOption key={m} value={m}>
                {m}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        <IonItem lines="none">
          <IonSelect
            label={t('rosters.year')}
            labelPlacement="stacked"
            interface="popover"
            value={year}
            onIonChange={(e) => onYear(Number(e.detail.value))}
          >
            {years.map((y) => (
              <IonSelectOption key={y} value={y}>
                {y}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        <IonItem lines="none">
          <IonSelect
            label={t('admin.branch')}
            labelPlacement="stacked"
            interface="popover"
            placeholder={t('common.all')}
            value={branchId}
            onIonChange={(e) => onBranch(e.detail.value)}
          >
            <IonSelectOption value="">{t('common.all')}</IonSelectOption>
            {branches.map((h) => (
              <IonSelectOption key={h.id} value={h.id}>
                {h.name}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        {departments && onDepartment && (
          <IonItem lines="none">
            <IonSelect
              label={t('nav.departments')}
              labelPlacement="stacked"
              interface="popover"
              placeholder={t('common.all')}
              value={departmentId}
              onIonChange={(e) => onDepartment(String(e.detail.value))}
            >
              <IonSelectOption value="">{t('common.all')}</IonSelectOption>
              {departments.map((d) => (
                <IonSelectOption key={d.id} value={d.id}>
                  {d.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        )}
      </div>

      <SearchBox field={field} search={search} onField={onField} onSearch={onSearch} />
    </div>
  );
}
