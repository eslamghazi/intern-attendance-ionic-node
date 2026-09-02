import { useMemo, useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import { handRightOutline, peopleOutline, pulseOutline, refreshOutline, trashOutline } from 'ionicons/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import AdminHeader from '../../components/AdminHeader';
import EmptyState from '../../components/ui/EmptyState';
import ListSkeleton from '../../components/ui/ListSkeleton';
import { listBranchOptions, listGroupOptions } from '../../lib/api/catalog';
import { listDepartmentOptions, listMemberDepartments } from '../../lib/api/departments';
import { listPresentNow } from '../../lib/api/attendance';
import {
  confirmMemberPresence,
  createPresenceCheck,
  deletePresenceCheck,
  listPresenceChecks,
  resolvePresenceCheck,
} from '../../lib/api/presence';
import SearchBox from '../../components/admin/SearchBox';
import type { SearchField } from '../../lib/api/members';
import { qk } from '../../lib/api/keys';
import { useServerToday } from '../../lib/useServerToday';
import { formatTime } from '../../lib/date';

/** The calendar day before `d` (yyyy-mm-dd) — overnight shifts started yesterday. */
const prevDate = (d: string) => {
  const dt = new Date(`${d}T00:00:00`);
  dt.setDate(dt.getDate() - 1);
  return dt.toISOString().slice(0, 10);
};

/**
 * Live presence check: an admin picks branch / department / group and instantly
 * sees who is ON shift right now — checked in and not yet checked out. Auto-
 * refreshes every 30s so it stays current.
 */
export default function LivePresencePage() {
  const { t } = useTranslation();
  const today = useServerToday();
  const yesterday = useMemo(() => prevDate(today), [today]);
  const [year, month] = today.split('-').map(Number);

  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [search, setSearch] = useState('');
  const [field, setField] = useState<SearchField>('name');

  const { data: branches = [] } = useQuery({ queryKey: qk.branchOptions, queryFn: listBranchOptions });
  const { data: groups = [] } = useQuery({ queryKey: qk.groupOptions, queryFn: listGroupOptions });
  const { data: departments = [] } = useQuery({
    queryKey: [...qk.departmentOptions, branchId],
    queryFn: () => listDepartmentOptions(branchId),
    enabled: !!branchId,
  });
  // Department membership is month-scoped — only needed when filtering by one.
  const { data: memberDept = {} } = useQuery({
    queryKey: ['member-departments', year, month],
    queryFn: () => listMemberDepartments(year, month),
    enabled: !!departmentId,
  });

  const {
    data: rows = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['present-now', today, yesterday],
    queryFn: () => listPresentNow([today, yesterday]),
    refetchInterval: 30_000, // live
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => r.checkout_status !== 'left_work') // auto-marked as gone
      .filter((r) => !branchId || r.branch_id === branchId)
      .filter((r) => !groupId || r.group_id === groupId)
      .filter((r) => !departmentId || memberDept[r.member_id] === departmentId)
      .filter(
        (r) =>
          !q ||
          (field === 'national_id' ? r.national_id : r.full_name).toLowerCase().includes(q),
      );
  }, [rows, branchId, groupId, departmentId, memberDept, search, field]);

  // Surprise spot-check requests created by this admin.
  const qc = useQueryClient();
  const [presentAlert] = useIonAlert();
  const [toast] = useIonToast();
  const checksQ = useQuery({
    queryKey: ['presence-checks'],
    queryFn: listPresenceChecks,
    refetchInterval: 15_000,
  });
  const activeChecks = (checksQ.data?.checks ?? []).filter((c) => c.status === 'open');

  const promptCreate = () =>
    presentAlert({
      header: t('presence.spotTitle'),
      message: t('presence.spotBody'),
      inputs: [{ name: 'min', type: 'number', min: 1, max: 240, value: 10 }],
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('presence.spotSend'),
          handler: async (v) => {
            const minutes = Math.max(1, Math.min(240, Number(v.min) || 10));
            try {
              const res = await createPresenceCheck({
                branch_id: branchId || undefined,
                group_id: groupId || undefined,
                department_id: departmentId || undefined,
                deadline_minutes: minutes,
              });
              toast({ message: t('presence.spotSent', { count: res.target_count }), duration: 2500, color: 'success' });
              void qc.invalidateQueries({ queryKey: ['presence-checks'] });
            } catch {
              toast({ message: t('presence.spotNoTargets'), duration: 2500, color: 'warning' });
            }
          },
        },
      ],
    });

  const promptDelete = (checkId: string) =>
    presentAlert({
      header: t('presence.deleteTitle'),
      message: t('presence.deleteBody'),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('common.delete'),
          role: 'destructive',
          handler: async () => {
            try {
              await deletePresenceCheck(checkId);
              void qc.invalidateQueries({ queryKey: ['presence-checks'] });
            } catch {
              toast({ message: t('common.error'), duration: 2000, color: 'danger' });
            }
          },
        },
      ],
    });

  const confirmMember = async (checkId: string, memberId: string) => {
    try {
      await confirmMemberPresence(checkId, memberId);
      void qc.invalidateQueries({ queryKey: ['presence-checks'] });
    } catch {
      toast({ message: t('common.error'), duration: 2000, color: 'danger' });
    }
  };

  const doResolve = async (checkId: string, decision: 'left_work' | 'keep') => {
    try {
      await resolvePresenceCheck(checkId, decision);
      void qc.invalidateQueries({ queryKey: ['presence-checks'] });
      void refetch();
    } catch {
      toast({ message: t('common.error'), duration: 2000, color: 'danger' });
    }
  };
  const promptResolve = (checkId: string, pending: number) =>
    presentAlert({
      header: t('presence.resolveTitle'),
      message: t('presence.resolveBody', { count: pending }),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('presence.resolveKeep'), handler: () => doResolve(checkId, 'keep') },
        { text: t('presence.resolveLeftWork'), role: 'destructive', handler: () => doResolve(checkId, 'left_work') },
      ],
    });

  return (
    <IonPage>
      <AdminHeader title={t('nav.presence')}>
        <IonButton onClick={promptCreate} title={t('presence.spotTitle')}>
          <IonIcon slot="icon-only" icon={handRightOutline} />
        </IonButton>
        <IonButton onClick={() => refetch()} title={t('common.refresh')}>
          {isRefetching ? <IonSpinner name="crescent" /> : <IonIcon slot="icon-only" icon={refreshOutline} />}
        </IonButton>
      </AdminHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => refetch().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Filters — narrow the "category" to confirm */}
        <div className="ui-surface ui-section" style={{ overflow: 'hidden' }}>
          <IonItem lines="none">
            <IonSelect
              label={t('nav.branches')}
              labelPlacement="stacked"
              interface="popover"
              placeholder={t('common.all')}
              value={branchId}
              onIonChange={(e) => {
                setBranchId(String(e.detail.value));
                setDepartmentId('');
              }}
            >
              <IonSelectOption value="">{t('common.all')}</IonSelectOption>
              {branches.map((b) => (
                <IonSelectOption key={b.id} value={b.id}>
                  {b.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonItem lines="none">
            <IonSelect
              label={t('nav.departments')}
              labelPlacement="stacked"
              interface="popover"
              placeholder={branchId ? t('common.all') : t('rosters.pickBranchToUpload')}
              disabled={!branchId}
              value={departmentId}
              onIonChange={(e) => setDepartmentId(String(e.detail.value))}
            >
              <IonSelectOption value="">{t('common.all')}</IonSelectOption>
              {departments.map((d) => (
                <IonSelectOption key={d.id} value={d.id}>
                  {d.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonItem lines="none">
            <IonSelect
              label={t('nav.groups')}
              labelPlacement="stacked"
              interface="popover"
              placeholder={t('common.all')}
              value={groupId}
              onIonChange={(e) => setGroupId(String(e.detail.value))}
            >
              <IonSelectOption value="">{t('common.all')}</IonSelectOption>
              {groups.map((g) => (
                <IonSelectOption key={g.id} value={g.id}>
                  {g.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <SearchBox field={field} search={search} onField={setField} onSearch={setSearch} />
        </div>

        {/* Active spot-check requests (confirm progress + resolve) */}
        {activeChecks.length > 0 && (
          <div className="ui-surface ui-section" style={{ overflow: 'hidden' }}>
            <div className="ui-caption" style={{ padding: '10px 14px 4px', fontWeight: 700 }}>
              {t('presence.spotActive')}
            </div>
            <IonList>
              {activeChecks.map((c) => {
                const pendingCount = c.target_count - c.confirmed_count;
                const allConfirmed = c.confirmed_count >= c.target_count;
                return (
                  <div key={c.id}>
                    <IonItem>
                      <IonLabel className="ion-text-wrap">
                        <h3 className="ltr-nums">
                          {c.confirmed_count} / {c.target_count} · {t('presence.spotConfirmed')}
                        </h3>
                        <p className="ui-caption ltr-nums">
                          {t('presence.confirmDeadline', { time: formatTime(c.deadline) })}
                        </p>
                      </IonLabel>
                      {allConfirmed ? (
                        // Everyone confirmed — nothing left to resolve.
                        <IonBadge slot="end" color="success">
                          {t('presence.spotAllConfirmed')}
                        </IonBadge>
                      ) : c.past_deadline ? (
                        <IonButton slot="end" size="small" color="warning" onClick={() => promptResolve(c.id, pendingCount)}>
                          {t('presence.resolveBtn')}
                        </IonButton>
                      ) : (
                        <IonBadge slot="end" color="medium">
                          {t('presence.spotWaiting')}
                        </IonBadge>
                      )}
                      <IonButton
                        slot="end"
                        size="small"
                        fill="clear"
                        color="danger"
                        onClick={() => promptDelete(c.id)}
                        title={t('common.delete')}
                      >
                        <IonIcon slot="icon-only" icon={trashOutline} />
                      </IonButton>
                    </IonItem>
                    {/* Not yet confirmed — the admin can confirm each in person. */}
                    {c.pending.map((p) => (
                      <IonItem key={p.member_id} lines="none">
                        <IonLabel className="ion-text-wrap" style={{ paddingInlineStart: 20 }}>
                          {p.full_name || p.member_id}
                        </IonLabel>
                        <IonButton slot="end" size="small" fill="outline" onClick={() => confirmMember(c.id, p.member_id)}>
                          {t('presence.manualConfirm')}
                        </IonButton>
                      </IonItem>
                    ))}
                  </div>
                );
              })}
            </IonList>
          </div>
        )}

        {/* Live count */}
        <div
          className="ui-surface ui-section"
          style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}
        >
          <IonIcon icon={pulseOutline} color="success" style={{ fontSize: 34 }} />
          <div>
            <div className="ltr-nums" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
              {filtered.length}
            </div>
            <IonNote>{t('presence.onShiftNow')}</IonNote>
          </div>
        </div>

        {isLoading ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState icon={peopleOutline} title={t('presence.none')} subtitle={t('presence.noneHint')} />
        ) : (
          <IonList>
            {filtered.map((r) => (
              <IonItem key={`${r.member_id}-${r.date}-${r.shift_id}`}>
                <IonLabel className="ion-text-wrap">
                  <h3>{r.full_name}</h3>
                  <p className="ltr-nums">
                    {[r.national_id, r.shift_name, r.branch_name, r.group_name]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </IonLabel>
                <IonNote slot="end" className="ltr-nums">
                  {formatTime(r.check_in_at)}
                </IonNote>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
}
