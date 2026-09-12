import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonPage,
  IonSpinner,
  useIonToast,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import AdminHeader from '../../components/AdminHeader';
import StatusBadge from '../../components/StatusBadge';
import { lookupMember, type LookupResult } from '../../lib/api/lookup';
import { TOAST_MS } from '../../lib/config';

/**
 * Find a member by code or national id, anywhere in the faculty.
 *
 * WHY THIS SCREEN EXISTS
 *
 * Every other member view is bounded by the admin's assignments — they see
 * their own branches and groups. That is right for browsing, and wrong for the
 * moment a student is standing in front of somebody at the wrong hospital.
 *
 * So this asks for an identifier the caller must already know, and answers with
 * exactly one member. It cannot be used to browse: there is no list and no
 * partial match. When the member belongs to another branch the screen SAYS so
 * — and the server records the lookup.
 */
export default function MemberLookupPage() {
  const { t } = useTranslation();
  const [toast] = useIonToast();

  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);

  const search = async () => {
    const q = query.trim();
    if (!q) return;

    setBusy(true);
    setResult(null);
    try {
      setResult(await lookupMember(q));
    } catch {
      toast({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <AdminHeader title={t('nav.memberLookup')} />
      <IonContent className="ion-padding">
        <IonItem>
          <IonLabel position="stacked">{t('lookup.identifier')}</IonLabel>
          <IonInput
            value={query}
            onIonInput={(e) => setQuery(e.detail.value ?? '')}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
            placeholder={t('lookup.placeholder')}
            enterkeyhint="search"
            autoFocus
          />
        </IonItem>

        <IonButton expand="block" onClick={() => void search()} disabled={busy || !query.trim()}>
          {busy ? <IonSpinner name="dots" /> : t('common.search')}
        </IonButton>

        {/* An exact-match lookup has exactly three outcomes, and each is said
            plainly — "nothing found" must never look like an empty list. */}
        {result?.found === false && (
          <IonNote color="medium" className="ion-padding-start">
            {t('lookup.notFound')}
          </IonNote>
        )}

        {result?.found && <MemberCard result={result} />}
      </IonContent>
    </IonPage>
  );
}

function MemberCard({ result }: { result: Extract<LookupResult, { found: true }> }) {
  const { t } = useTranslation();
  const m = result.member;

  const rows: [string, string][] = [
    [t('report.member_code'), m.member_code ?? '—'],
    [t('auth.nationalId'), m.national_id],
    [t('admin.branch'), m.branch_name ?? '—'],
    [t('admin.group'), m.group_name ?? '—'],
    [t('admin.institution'), m.institution_name ?? '—'],
    [t('admin.phone'), m.phone ?? '—'],
    [t('admin.email'), m.email ?? '—'],
  ];

  return (
    <div className="ion-margin-top">
      {/* Said out loud, because the whole point of this screen is that the
          answer may be somebody else's student. */}
      {!result.in_scope && (
        <IonNote color="warning" className="ion-padding-start">
          {t('lookup.outsideYourBranches')}
        </IonNote>
      )}

      <h2 className="ion-padding-start">{m.full_name}</h2>

      <div className="ion-padding-start ion-padding-bottom">
        <StatusBadge
          status={m.is_active ? 'present' : 'absent'}
          label={t(m.is_active ? 'admin.active' : 'admin.inactive')}
        />{' '}
        <StatusBadge
          status={m.has_face ? 'present' : 'pending'}
          label={t(m.has_face ? 'lookup.enrolled' : 'lookup.notEnrolled')}
        />
      </div>

      {rows.map(([label, value]) => (
        <IonItem key={label}>
          <IonLabel>
            <IonNote>{label}</IonNote>
            <div>{value}</div>
          </IonLabel>
        </IonItem>
      ))}
    </div>
  );
}
