import { useMemo, useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonToggle,
} from '@ionic/react';
import {
  chevronBackOutline,
  chevronForwardOutline,
  refreshOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import AdminHeader from '../../components/AdminHeader';
import SectionHeader from '../../components/ui/SectionHeader';
import EmptyState from '../../components/ui/EmptyState';
import {
  AUDIT_EVENTS,
  SECURITY_EVENTS,
  auditSummary,
  listAudit,
  type AuditEntry,
  type AuditFilters,
} from '../../lib/api/audit';
import { LIMITS } from '../../lib/config';
import type { JsonValue } from '../../lib/json.types';

// NOT the grid PAGE_SIZE — see LIMITS.AUDIT_PAGE_SIZE for why a log pages taller.
const PAGE_SIZE = LIMITS.AUDIT_PAGE_SIZE;

/** Today and 30 days back, as YYYY-MM-DD — the range the page opens on. */
function defaultRange(): { from: string; to: string } {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const now = new Date();
  const back = new Date(now.getTime() - 30 * 86_400_000);
  return { from: day(back), to: day(now) };
}

/**
 * Render the event payload without pretending to understand it.
 *
 * Every event carries a different shape — a distance and a radius, a face
 * score, a method and a path. Rendering each one properly would be fifteen
 * little components that drift from the server the first time a field is added,
 * so the keys are shown as they come. The one thing done deliberately is
 * dropping nulls: an event with eight keys of which two are set is unreadable
 * with the other six spelling out "null".
 */
function Detail({ detail }: { detail: JsonValue }) {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null;
  const entries = Object.entries(detail).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  );
  if (!entries.length) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {entries.map(([k, v]) => (
        <IonChip key={k} outline style={{ margin: 0, height: 22, fontSize: 11 }}>
          <IonLabel>
            {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </IonLabel>
        </IonChip>
      ))}
    </div>
  );
}

/**
 * The audit trail.
 *
 * There was no way to read this at all until now: the table recorded every
 * mock-location refusal, face mismatch and master-password sign-in, and the
 * only way to see one was psql on the server.
 *
 * An admin sees the events of members in the branches and groups they run; a
 * superadmin sees everything, including events by staff. The server decides
 * that — see AuditRepository.scopePredicate — so there is nothing here that
 * could widen it.
 */
export default function AuditPage() {
  const { t } = useTranslation();

  const [range, setRange] = useState(defaultRange);
  const [events, setEvents] = useState<string[]>([]);
  const [securityOnly, setSecurityOnly] = useState(false);
  const [page, setPage] = useState(1);

  const filters: AuditFilters = useMemo(
    () => ({
      from: range.from || undefined,
      to: range.to || undefined,
      event: events.length ? events : undefined,
      security_only: securityOnly || undefined,
    }),
    [range.from, range.to, events, securityOnly],
  );

  // Any filter change invalidates the page number: staying on page 7 of a
  // result set that now has two pages shows an empty table and looks broken.
  const resetTo = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['audit', filters, page],
    queryFn: () => listAudit(filters, page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  const { data: summary = {} } = useQuery({
    queryKey: ['audit-summary', filters],
    queryFn: () => auditSummary(filters),
  });

  const rows: AuditEntry[] = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const topEvents = useMemo(
    () =>
      Object.entries(summary)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
    [summary],
  );

  return (
    <IonPage>
      <AdminHeader title={t('nav.audit')} />
      <IonContent className="ion-padding">
        <SectionHeader title={t('audit.title')} />
        <IonNote className="ion-text-wrap" style={{ display: 'block', margin: '0 4px 12px' }}>
          {t('audit.subtitle')}
        </IonNote>

        <IonList inset>
          <IonItem>
            <IonLabel position="stacked">{t('audit.from')}</IonLabel>
            <IonInput
              type="date"
              value={range.from}
              onIonChange={(e) => resetTo(setRange)({ ...range, from: e.detail.value ?? '' })}
            />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">{t('audit.to')}</IonLabel>
            <IonInput
              type="date"
              value={range.to}
              onIonChange={(e) => resetTo(setRange)({ ...range, to: e.detail.value ?? '' })}
            />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">{t('audit.event')}</IonLabel>
            <IonSelect
              multiple
              value={events}
              placeholder={t('audit.allEvents')}
              disabled={securityOnly}
              onIonChange={(e) => resetTo(setEvents)(e.detail.value ?? [])}
            >
              {AUDIT_EVENTS.map((ev) => (
                <IonSelectOption key={ev} value={ev}>
                  {t(`audit.events.${ev}`)}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonIcon icon={shieldCheckmarkOutline} slot="start" color="danger" />
            <IonLabel>
              {t('audit.securityOnly')}
              <IonNote className="ion-text-wrap" style={{ display: 'block', fontSize: 12 }}>
                {t('audit.securityOnlyHint')}
              </IonNote>
            </IonLabel>
            <IonToggle
              checked={securityOnly}
              onIonChange={(e) => resetTo(setSecurityOnly)(e.detail.checked)}
            />
          </IonItem>
        </IonList>

        {topEvents.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 4px 16px' }}>
            {topEvents.map(([ev, n]) => (
              <IonChip
                key={ev}
                color={SECURITY_EVENTS.includes(ev) ? 'danger' : 'medium'}
                outline
                style={{ margin: 0 }}
              >
                <IonLabel>
                  {t(`audit.events.${ev}`)} · {n}
                </IonLabel>
              </IonChip>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 4px 8px' }}>
          <IonNote style={{ flex: 1 }}>{t('audit.total', { count: total })}</IonNote>
          {isFetching && <IonSpinner name="dots" />}
          <IonButton size="small" fill="clear" onClick={() => refetch()}>
            <IonIcon slot="icon-only" icon={refreshOutline} />
          </IonButton>
        </div>

        {rows.length === 0 && !isFetching ? (
          <EmptyState title={t('audit.empty')} />
        ) : (
          <IonList inset>
            {rows.map((r) => {
              const security = SECURITY_EVENTS.includes(r.event) || r.event === 'server_error';
              return (
                <IonItem key={r.id} lines="full">
                  <IonLabel className="ion-text-wrap">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IonBadge color={security ? 'danger' : 'medium'}>
                        {t(`audit.events.${r.event}`, { defaultValue: r.event })}
                      </IonBadge>
                      <IonNote style={{ fontSize: 12 }}>
                        {new Date(r.created_at).toLocaleString()}
                      </IonNote>
                    </div>
                    <h3 style={{ marginTop: 6 }}>
                      {r.actor_name ?? t('audit.noActor')}
                      {r.actor_national_id ? ` · ${r.actor_national_id}` : ''}
                      {r.actor_role ? ` · ${t(`roles.${r.actor_role}`, { defaultValue: r.actor_role })}` : ''}
                    </h3>
                    <Detail detail={r.detail} />
                  </IonLabel>
                </IonItem>
              );
            })}
          </IonList>
        )}

        {pages > 1 && (
          <IonButtons style={{ justifyContent: 'center', gap: 12, padding: 12 }}>
            <IonButton disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <IonIcon slot="icon-only" icon={chevronBackOutline} />
            </IonButton>
            <IonNote style={{ alignSelf: 'center' }}>{`${page} / ${pages}`}</IonNote>
            <IonButton disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              <IonIcon slot="icon-only" icon={chevronForwardOutline} />
            </IonButton>
          </IonButtons>
        )}
      </IonContent>
    </IonPage>
  );
}
