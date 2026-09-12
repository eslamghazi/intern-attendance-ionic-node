import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { downloadOutline, timeOutline } from 'ionicons/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthContext';
import { getAttendanceHistory } from '../../lib/api/attendance';
import { qk } from '../../lib/api/keys';
import { MONTHS } from '../../lib/config';
import { formatDate, formatTime } from '../../lib/date';
import { appToday } from '../../lib/clock';
import MemberHeader from '../../components/MemberHeader';
import OutcomeBadge, { OutcomeLegend } from '../../components/OutcomeBadge';
import EmptyState from '../../components/ui/EmptyState';
import ListSkeleton from '../../components/ui/ListSkeleton';
import { useServerExport } from '../../components/useServerExport';

export default function HistoryPage() {
  const { t } = useTranslation();
  const { member } = useAuth();
  const serverExport = useServerExport();

  // Default to the current month.
  const [ym, setYm] = useState(() => {
    const [y, m] = appToday().split('-');
    return { year: Number(y), month: Number(m) };
  });
  const base = Number(appToday().slice(0, 4));
  const years = [base - 3, base - 2, base - 1, base, base + 1];

  const { data, isLoading, refetch } = useQuery({
    queryKey: [...qk.memberHistory(member?.id), ym.year, ym.month],
    queryFn: () => getAttendanceHistory(member!.id, ym.year, ym.month),
    enabled: !!member,
  });

  const rows = data ?? [];
  const pad = (n: number) => String(n).padStart(2, '0');
  // The SERVER builds this file — the same rows, legend and colours the admin
  // exports use, from one place. The page used to assemble it here, which meant
  // the report existed twice and the two drifted: a mark added to the shared
  // vocabulary reached the admin exports and not this one.
  const doExport = () => {
    if (!rows.length) return;
    serverExport(
      '/attendance/history/export',
      { member_id: member?.id, year: ym.year, month: ym.month },
      `my-attendance_${ym.year}_${pad(ym.month)}`,
    );
  };

  return (
    <IonPage>
      <MemberHeader title={t('nav.history')} />
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => refetch().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Month / year picker (defaults to the current month) + export */}
        <div className="ui-surface ui-section" style={{ overflow: 'hidden' }}>
          <div className="grid-filter-row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <IonItem lines="none">
              <IonSelect
                label={t('rosters.month')}
                interface="popover"
                value={ym.month}
                onIonChange={(e) => setYm((s) => ({ ...s, month: Number(e.detail.value) }))}
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
                interface="popover"
                value={ym.year}
                onIonChange={(e) => setYm((s) => ({ ...s, year: Number(e.detail.value) }))}
              >
                {years.map((y) => (
                  <IonSelectOption key={y} value={y}>
                    {y}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 12px 12px' }}>
            <IonButton size="small" fill="outline" disabled={rows.length === 0} onClick={doExport}>
              <IonIcon slot="start" icon={downloadOutline} />
              {t('common.printReport')}
            </IonButton>
          </div>
        </div>

        {isLoading ? (
          <ListSkeleton avatar={false} />
        ) : rows.length === 0 ? (
          <EmptyState icon={timeOutline} title={t('attendance.noRecords')} />
        ) : (
          <div className="ui-surface ui-section" style={{ overflow: 'hidden' }}>
            {rows.map((r) => (
              <div key={r.id} className="hist-day">
                <div className="hist-day__head">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="ltr-nums" style={{ fontWeight: 700 }}>
                      {formatDate(r.date)}
                    </span>
                    {r.shift_name && (
                      <span
                        className="ui-caption"
                        style={{
                          background: 'var(--app-hairline)',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontWeight: 600,
                        }}
                      >
                        {r.shift_name}
                      </span>
                    )}
                  </span>
                  <OutcomeBadge outcome={r.outcome} />
                </div>
                {/* An off day has no shift and no times — showing two empty
                    slots reads as missing data rather than as a day off. */}
                {r.outcome !== 'off' && (
                <div className="hist-day__body">
                  <div className="hist-ev">
                    <span className="ui-caption">{t('attendance.checkInAt')}</span>
                    <span className="ltr-nums" style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                      {formatTime(r.check_in_at)}
                    </span>
                  </div>
                  <div className="hist-ev">
                    <span className="ui-caption">{t('attendance.checkOutAt')}</span>
                    <span className="ltr-nums" style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                      {formatTime(r.check_out_at)}
                    </span>
                  </div>
                </div>
                )}
              </div>
            ))}
            <OutcomeLegend />
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
