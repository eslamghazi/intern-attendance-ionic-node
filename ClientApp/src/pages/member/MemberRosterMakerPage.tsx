import { useMemo, useState } from 'react';
import { IonContent, IonItem, IonPage, IonSelect, IonSelectOption } from '@ionic/react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getRosterMakerData } from '../../lib/api/members';
import { MONTHS } from '../../lib/config';
import { appToday } from '../../lib/clock';
import MemberHeader from '../../components/MemberHeader';
import RosterMakerGrid, { type MakerSeedCell } from '../../components/admin/RosterMakerGrid';
import { useAuth } from '../../lib/auth/AuthContext';

export default function MemberRosterMakerPage() {
  const { t } = useTranslation();
  const { member } = useAuth();
  const now = appToday();
  const [month, setMonth] = useState(Number(now.slice(5, 7)));
  const [year, setYear] = useState(Number(now.slice(0, 4)));
  const baseYear = Number(now.slice(0, 4));
  const yearOpts = [baseYear - 1, baseYear, baseYear + 1];
  const daysInMonth = new Date(year, month, 0).getDate();

  const { data } = useQuery({
    queryKey: ['member-roster-maker', year, month],
    queryFn: () => getRosterMakerData(year, month),
  });

  const members = useMemo(
    () => (data?.members ?? []).map((m) => ({ id: m.member_id, code: m.code ?? '', name: m.full_name })),
    [data],
  );
  const seed = useMemo<MakerSeedCell[]>(
    () => (data?.roster ?? []).filter((r) => r.key).map((r) => ({ member_id: r.member_id, day: r.day, key: r.key as string })),
    [data],
  );
  const keyedShifts = useMemo(
    () => (data?.shifts ?? []).filter((s) => s.key).map((s) => ({ key: String(s.key).trim(), name: s.name })),
    [data],
  );

  return (
    <IonPage>
      <MemberHeader title={t('nav.rosterMaker')} />
      <IonContent>
        <div className="ui-surface ui-section" style={{ overflow: 'hidden' }}>
          <div className="grid-filter-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
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
          </div>
        </div>

        <RosterMakerGrid members={members} shifts={keyedShifts} seed={seed} year={year} month={month} daysInMonth={daysInMonth} scopeKey="member" selfId={member?.id} />
      </IonContent>
    </IonPage>
  );
}
