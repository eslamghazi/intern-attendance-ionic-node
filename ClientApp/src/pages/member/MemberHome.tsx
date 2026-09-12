import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  useIonToast,
} from '@ionic/react';
import { useEffect, useState, type ReactNode } from 'react';
import { copyOutline, eyeOffOutline, eyeOutline, shieldCheckmark } from 'ionicons/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthContext';
import { getDayAttendance, getDayShifts } from '../../lib/api/attendance';
import { getMyMemberCode } from '../../lib/api/members';
import { qk } from '../../lib/api/keys';
import { useServerToday } from '../../lib/useServerToday';
import { formatClock, formatTime } from '../../lib/date';
import { ROUTES } from '../../lib/routes';
import MemberHeader from '../../components/MemberHeader';
import BrandHeader from '../../components/BrandHeader';
import ServerClock from '../../components/ServerClock';
import Copyright from '../../components/Copyright';
import StatusBadge, { STATUS_COLOR } from '../../components/StatusBadge';
import DonutStat from '../../components/ui/DonutStat';
import Avatar from '../../components/ui/Avatar';
import { TIMING } from '../../lib/config';

/** How long a revealed national ID stays visible before it re-masks itself. */
const REVEAL_MS = TIMING.QR_REVEAL_MS;

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="ui-row">
      <span className="ui-muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function MemberHome() {
  const { t } = useTranslation();
  const { profile, member } = useAuth();

  // The national ID is masked by default — this screen gets shown to whoever is
  // standing next to the member. Revealing it times out on its own so it is not
  // left uncovered on a phone lying on a desk.
  const nationalId = profile?.national_id ?? '';
  const [showId, setShowId] = useState(false);
  useEffect(() => {
    if (!showId) return;
    const timer = setTimeout(() => setShowId(false), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [showId]);

  const serverToday = useServerToday();
  const { data: todayAtt = [], refetch } = useQuery({
    queryKey: [...qk.memberToday(member?.id), serverToday],
    queryFn: () => getDayAttendance(member!.id, serverToday),
    enabled: !!member,
  });
  const { data: shifts = [] } = useQuery({
    queryKey: [...qk.memberToday(member?.id), serverToday, 'shift'],
    queryFn: () => getDayShifts(member!.id, serverToday),
    enabled: !!member,
  });
  const hasShift = shifts.length > 0;

  const { data: memberCode } = useQuery({
    queryKey: ['my-member-code', member?.id],
    queryFn: getMyMemberCode,
    enabled: !!member,
  });

  const [presentToast] = useIonToast();
  const copyText = async (value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      presentToast({ message: t('common.copied'), duration: 1000, color: 'success' });
    } catch {
      /* ignore */
    }
  };

  // Progress across ALL of today's shifts: each shift contributes a check-in and
  // a check-out (so 2 steps per shift).
  const attBy = new Map(todayAtt.map((a) => [a.shift_id, a]));
  const steps = Math.max(shifts.length, todayAtt.length) * 2;
  const done = todayAtt.reduce(
    (n, a) => n + (a.check_in_at ? 1 : 0) + (a.check_out_at ? 1 : 0),
    0,
  );
  // Next action = the first shift still needing a check-in or check-out.
  const pending = shifts.find((s) => {
    const a = attBy.get(s.id);
    return !a?.check_in_at || !a?.check_out_at;
  });
  const nextAction = !pending
    ? null
    : !attBy.get(pending.id)?.check_in_at
      ? t('member.startCheckIn')
      : t('member.startCheckOut');

  return (
    <IonPage>
      <MemberHeader title={t('nav.home')} />
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => refetch().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        <BrandHeader />
        <ServerClock />

        <div className="ui-section" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <Avatar name={profile?.full_name} src={profile?.avatar_url} size={84} />
          </div>
          <h2 className="ui-h2" style={{ marginBottom: 14 }}>
            {t('member.welcome', { name: profile?.full_name ?? '' })}
          </h2>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <DonutStat
              segments={
                hasShift && steps > 0
                  ? [
                      { value: done, color: STATUS_COLOR.present.solid },
                      { value: Math.max(0, steps - done), color: 'transparent' },
                    ]
                  : [{ value: 1, color: 'var(--ion-color-step-150, #e0e0e0)' }]
              }
              centerTop={hasShift && steps > 0 ? `${done}/${steps}` : '—'}
              centerBottom={t('member.todayStatus')}
            />
          </div>
        </div>

        <div className="ui-surface ui-section">
          <Row
            label={t('admin.memberCode')}
            value={
              <span
                className="ltr-nums"
                onClick={() => copyText(memberCode)}
                title={t('common.copy')}
                style={{
                  fontWeight: 700,
                  color: 'var(--ion-color-primary)',
                  cursor: memberCode ? 'pointer' : 'default',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {memberCode ?? '—'}
                {memberCode && <IonIcon icon={copyOutline} style={{ fontSize: 14 }} />}
              </span>
            }
          />
          <Row
            label={t('auth.nationalId')}
            value={
              nationalId ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <span className="ltr-nums">
                    {showId ? nationalId : '•'.repeat(nationalId.length)}
                  </span>
                  <IonButton
                    fill="clear"
                    size="small"
                    style={{ margin: 0, height: 24, '--padding-start': '4px', '--padding-end': '4px' }}
                    onClick={() => setShowId((v) => !v)}
                    title={t(showId ? 'common.hide' : 'common.show')}
                    aria-label={t(showId ? 'common.hide' : 'common.show')}
                  >
                    <IonIcon
                      slot="icon-only"
                      icon={showId ? eyeOffOutline : eyeOutline}
                      style={{ fontSize: 16 }}
                    />
                  </IonButton>
                </span>
              ) : (
                '—'
              )
            }
          />
          {profile?.email && (
            <Row label={t('admin.email')} value={<span className="ltr-nums">{profile.email}</span>} />
          )}
          <Row
            label={t('admin.institutionName')}
            value={member?.group?.institution?.name ?? member?.group?.institution_name ?? '—'}
          />
          <Row label={t('member.yourBranch')} value={member?.branch?.name ?? '—'} />
          <Row label={t('member.yourGroup')} value={member?.group?.name ?? '—'} />
          {!hasShift && (
            <Row
              label={t('member.yourShift')}
              value={<span className="ui-muted">{t('member.noShiftToday')}</span>}
            />
          )}
        </div>

        {/* One compact card per shift today (a member may have more than one). */}
        {shifts.map((shift) => {
          const a = attBy.get(shift.id);
          return (
            <div className="ui-surface ui-section shift-card" key={shift.id}>
              <div className="hist-day__head">
                <span className="ltr-nums" style={{ fontWeight: 700 }}>{shift.name}</span>
                {a ? (
                  <StatusBadge status={a.status} />
                ) : (
                  <span className="ui-caption">{t('member.notCheckedIn')}</span>
                )}
              </div>
              <div className="hist-day__body">
                <div className="hist-ev">
                  <span className="ui-caption">{t('attendance.checkInAt')}</span>
                  <span className="ltr-nums" style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                    {formatTime(a?.check_in_at)}
                  </span>
                </div>
                <div className="hist-ev">
                  <span className="ui-caption">{t('attendance.checkOutAt')}</span>
                  <span className="ltr-nums" style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                    {formatTime(a?.check_out_at)}
                  </span>
                </div>
              </div>
              <div className="shift-windows">
                <div className="shift-windows__row">
                  <span>{t('shifts.checkin')}</span>
                  <span className="ltr-nums">
                    {formatClock(shift.checkin_open ?? shift.start_time)} –{' '}
                    {formatClock(shift.checkin_close ?? shift.start_time)}
                  </span>
                </div>
                <div className="shift-windows__row">
                  <span>{t('shifts.late')}</span>
                  <span className="ltr-nums">{formatClock(shift.checkin_late ?? shift.start_time)}</span>
                </div>
                <div className="shift-windows__row">
                  <span>{t('shifts.checkout')}</span>
                  <span className="ltr-nums">
                    {formatClock(shift.checkout_open ?? shift.end_time)} –{' '}
                    {formatClock(shift.checkout_close ?? shift.end_time)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        <div className="ui-section">
          {!hasShift ? (
            <IonButton expand="block" disabled>
              {t('member.noShiftToday')}
            </IonButton>
          ) : nextAction ? (
            <IonButton expand="block" routerLink={ROUTES.member.checkIn}>
              <IonIcon slot="start" icon={shieldCheckmark} />
              {nextAction}
            </IonButton>
          ) : (
            <IonButton expand="block" disabled>
              {t('member.checkedOut')}
            </IonButton>
          )}
        </div>
        <Copyright />
      </IonContent>
    </IonPage>
  );
}
