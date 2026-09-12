import { useState } from 'react';
import {
  IonChip,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSpinner,
} from '@ionic/react';
import { checkmarkCircle, closeCircle, peopleOutline } from 'ionicons/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listMemberPage, type MemberPageItem, type SearchField } from '../../lib/api/members';
import Pager from '../ui/Pager';
import SearchBox from './SearchBox';
import { LIMITS } from '../../lib/config';

/** Names per page. The list starts populated (no search needed) and pages
 *  through, so browsing a thousand members never builds a thousand list items. */
const PER_PAGE = LIMITS.PICKER_PAGE_SIZE;

/** Search for members by name / national id / code and pick one (or several).
 *  Shared by the admin face tools so both find people the same way. */
export default function MemberPicker({
  selected,
  onChange,
  multiple = false,
}: {
  selected: MemberPageItem[];
  onChange: (next: MemberPageItem[]) => void;
  multiple?: boolean;
}) {
  const { t } = useTranslation();
  const [field, setField] = useState<SearchField>('name');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const term = search.trim();
  // No search term means "everyone", alphabetically — the picker is useful
  // before anything is typed.
  const { data, isFetching } = useQuery({
    queryKey: ['member-picker', field, term, page],
    queryFn: () => listMemberPage({ branchId: '', page, pageSize: PER_PAGE, search: term, field }),
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const isPicked = (id: string) => selected.some((m) => m.member_id === id);
  const toggle = (m: MemberPageItem) => {
    if (isPicked(m.member_id)) {
      onChange(selected.filter((x) => x.member_id !== m.member_id));
    } else {
      onChange(multiple ? [...selected, m] : [m]);
    }
  };

  return (
    <>
      <SearchBox
        field={field}
        search={search}
        onField={(f) => {
          setPage(1);
          setField(f);
        }}
        onSearch={(s) => {
          setPage(1); // a new search starts from the first page again
          setSearch(s);
        }}
      />

      {/* How many members the current search matches — the whole set, not the
          page. Selecting from a list is much easier when you know its size. */}
      <div className="grid-summary">
        <IonChip color="primary">
          <IonIcon icon={peopleOutline} />
          <IonLabel className="ltr-nums">
            {total} · {t('nav.members')}
          </IonLabel>
        </IonChip>
      </div>

      {selected.length > 0 && (
        <div style={{ padding: '4px 8px' }}>
          {selected.map((m) => (
            <IonChip key={m.member_id} color="primary" onClick={() => toggle(m)}>
              <IonLabel>{m.full_name}</IonLabel>
              <IonIcon icon={closeCircle} />
            </IonChip>
          ))}
        </div>
      )}

      <IonList>
        {isFetching && !data ? (
          <IonItem lines="none">
            <IonSpinner name="dots" />
          </IonItem>
        ) : !items.length ? (
          <IonItem lines="none">
            <IonNote>{t('common.none')}</IonNote>
          </IonItem>
        ) : (
          items.map((m) => (
            <IonItem key={m.member_id} button onClick={() => toggle(m)}>
              <IonLabel>
                <h3>{m.full_name}</h3>
                <IonNote className="ltr-nums">{m.member_code || m.national_id}</IonNote>
              </IonLabel>
              {isPicked(m.member_id) && <IonIcon slot="end" icon={checkmarkCircle} color="success" />}
            </IonItem>
          ))
        )}
      </IonList>

      {pages > 1 && <Pager page={page} pages={pages} onPage={setPage} />}
    </>
  );
}
