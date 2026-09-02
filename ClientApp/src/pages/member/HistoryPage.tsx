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
import StatusBadge, { STATUS_COLOR } from '../../components/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ListSkeleton from '../../components/ui/ListSkeleton';
import { useReportExport } from '../../components/admin/useReportExport';

export default function HistoryPage() {
  const { t } = useTranslation();
  const { member, profile } = useAuth();
  const exportReport = useReportExport();

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
  // A pending shift in the future is simply upcoming; a pending shift today
  // is one they still have to turn up for. Same status, different message.
  const statusLabel = (r: (typeof rows)[number]) =>
    r.status === 'pending' && r.date > appToday()
      ? t('attendance.upcoming')
      : t(`attendance.${r.status}`);

  const doExport = () => {
    if (!rows.length) return;
    exportReport({
      title: `${t('nav.history')} — ${pad(ym.month)}/${ym.year}`,
      subtitle: profile?.full_name,
      filename: `my-attendance_${ym.year}_${pad(ym.month)}`,
      headers: [
        t('attendance.date'),
        t('attendance.shift'),
        t('attendance.checkInAt'),
        t('attendance.checkOutAt'),
        t('attendance.status'),
      ],
      rows: [
        ...rows.map((r) => [
          formatDate(r.date),
          r.shift_name ?? '',
          formatTime(r.check_in_at),
          formatTime(r.check_out_at),
          statusLabel(r),
        ]),
        // The month in one line: how many of each status.
        [
          t('rosters.total'),
          String(rows.length),
          '',
          '',
          Object.entries(
            rows.reduce<Record<string, number>>((acc, r) => {
              acc[r.status] = (acc[r.status] ?? 0) + 1;
              return acc;
            }, {}),
          )
            .map(([s, n]) => `${t(`attendance.${s}`)}: ${n}`)
            .join(' · '),
        ],
      ],
      cellColors: [
        ...rows.map((r) => [undefined, undefined, undefined, undefined, STATUS_COLOR[r.status]?.fill]),
        [],
      ],
    });
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
                  <StatusBadge status={r.status} label={statusLabel(r)} />
                </div>
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
              </div>
            ))}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
