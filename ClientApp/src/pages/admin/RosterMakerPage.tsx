import { useMemo, useState } from 'react';
import {
  IonContent,
  IonItem,
  IonPage,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listBranchOptions, listShifts } from '../../lib/api/catalog';
import { listRosterForBranchMonth } from '../../lib/api/members';
import { qk } from '../../lib/api/keys';
import { MONTHS, REPORT_PAGE_SIZE } from '../../lib/config';
import { appToday } from '../../lib/clock';
import AdminHeader from '../../components/AdminHeader';
import RosterMakerGrid, { type MakerSeedCell } from '../../components/admin/RosterMakerGrid';

export default function RosterMakerPage() {
  const { t } = useTranslation();
  const now = appToday();
  const [month, setMonth] = useState(Number(now.slice(5, 7)));
  const [year, setYear] = useState(Number(now.slice(0, 4)));
  const [branchId, setBranchId] = useState('');

  const { data: branches = [] } = useQuery({ queryKey: qk.branchOptions, queryFn: listBranchOptions });
  const { data: shifts = [] } = useQuery({ queryKey: qk.shifts, queryFn: listShifts });
  const baseYear = Number(now.slice(0, 4));
  const yearOpts = [baseYear - 3, baseYear - 2, baseYear - 1, baseYear, baseYear + 1];
  const daysInMonth = new Date(year, month, 0).getDate();

  const { data } = useQuery({
    queryKey: ['roster-maker-admin', branchId, year, month],
    queryFn: () =>
      listRosterForBranchMonth({ branchId, year, month, page: 1, pageSize: REPORT_PAGE_SIZE, search: '', field: 'name' }),
    enabled: !!branchId,
  });

  const members = useMemo(
    () => (data?.rows ?? []).map((r) => ({ id: r.member_id, code: r.member_code ?? '', name: r.full_name })),
    [data],
  );
  const seed = useMemo<MakerSeedCell[]>(() => {
    const out: MakerSeedCell[] = [];
    for (const r of data?.rows ?? [])
      for (const [day, cells] of Object.entries(r.days))
        for (const c of cells) out.push({ member_id: r.member_id, day: Number(day), key: c.label });
    return out;
  }, [data]);
  const keyedShifts = useMemo(
    () => shifts.filter((s) => s.key).map((s) => ({ key: String(s.key).trim(), name: s.name })),
    [shifts],
  );

  return (
    <IonPage>
      <AdminHeader title={t('nav.rosterMaker')} />
      <IonContent>
        <div className="ui-surface ui-section" style={{ overflow: 'hidden' }}>
          <div className="grid-filter-row">
            <IonItem lines="none">
              <IonSelect label={t('rosters.month')} labelPlacement="stacked" interface="popover" value={month} onIonChange={(e) => setMonth(Number(e.detail.value))}>
                {MONTHS.map((m) => (
                  <IonSelectOption key={m} value={m}>
                    {m}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem lines="none">
              <IonSelect label={t('rosters.year')} labelPlacement="stacked" interface="popover" value={year} onIonChange={(e) => setYear(Number(e.detail.value))}>
                {yearOpts.map((y) => (
                  <IonSelectOption key={y} value={y}>
                    {y}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem lines="none">
              <IonSelect label={t('admin.branch')} labelPlacement="stacked" interface="popover" placeholder={t('common.select')} value={branchId} onIonChange={(e) => setBranchId(String(e.detail.value))}>
                {branches.map((b) => (
                  <IonSelectOption key={b.id} value={b.id}>
                    {b.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </div>
        </div>

        {branchId ? (
          <RosterMakerGrid members={members} shifts={keyedShifts} seed={seed} year={year} month={month} daysInMonth={daysInMonth} scopeKey={`admin:${branchId}`} />
        ) : (
          <div className="ui-caption" style={{ padding: 20, textAlign: 'center' }}>{t('rosters.pickBranchToUpload')}</div>
        )}
      </IonContent>
    </IonPage>
  );
}
