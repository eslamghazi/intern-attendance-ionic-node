import { IonSearchbar, IonSelect, IonSelectOption } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { SearchField } from '../../lib/api/members';
import { SEARCH_DEBOUNCE_MS } from '../../lib/config';

/** Field selector + debounced search input, shared by every admin search UI. */
export default function SearchBox({
  field,
  search,
  onField,
  onSearch,
}: {
  field: SearchField;
  search: string;
  onField: (f: SearchField) => void;
  onSearch: (s: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid-search-row">
      <IonSelect
        aria-label={t('admin.searchBy')}
        interface="popover"
        value={field}
        onIonChange={(e) => onField(e.detail.value)}
      >
        <IonSelectOption value="name">{t('admin.byName')}</IonSelectOption>
        <IonSelectOption value="national_id">{t('admin.byId')}</IonSelectOption>
        <IonSelectOption value="code">{t('admin.byCode')}</IonSelectOption>
      </IonSelect>
      <IonSearchbar
        className="grid-searchbar"
        value={search}
        debounce={SEARCH_DEBOUNCE_MS}
        placeholder={t('admin.search')}
        onIonInput={(e) => onSearch(e.detail.value ?? '')}
      />
    </div>
  );
}
