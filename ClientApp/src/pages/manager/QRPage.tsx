import { useEffect, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonMenuButton,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  useIonLoading,
  useIonToast,
} from '@ionic/react';
import { logOut, qrCodeOutline, refreshOutline } from 'ionicons/icons';
import QRCode from 'qrcode';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthContext';
import { useConfirmSignOut } from '../../lib/auth/useConfirmSignOut';
import { listBranchOptions } from '../../lib/api/catalog';
import { listMemberPage } from '../../lib/api/members';
import { getSettings } from '../../lib/api/settings';
import { createQr } from '../../lib/api/admin';
import { qk } from '../../lib/api/keys';
import { TOAST_MS } from '../../lib/config';
import { formatDate } from '../../lib/date';
import { appToday } from '../../lib/clock';
import DateField from '../../components/ui/DateField';
import ServerClock from '../../components/ServerClock';
import Copyright from '../../components/Copyright';
import ThemeToggle from '../../components/ThemeToggle';
import LanguageToggle from '../../components/LanguageToggle';

/** QR image wrapped by a circular countdown ring that depletes as the current
 *  token nears expiry. */
function QrRing({ url, secondsLeft, total }: { url: string; secondsLeft: number; total: number }) {
  const SIZE = 300;
  const STROKE = 9;
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;
  const pct = total > 0 ? Math.max(0, Math.min(1, secondsLeft / total)) : 0;
  const offset = C * (1 - pct);
  // Warn (amber) in the last 5 seconds.
  const color = secondsLeft <= 5 ? 'var(--ion-color-warning)' : 'var(--ion-color-primary)';
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: SIZE, aspectRatio: '1 / 1', margin: '0 auto' }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--ion-color-step-200, #e2e2e2)" strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <img
        src={url}
        alt="QR"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '64%',
          height: '64%',
          borderRadius: 8,
          background: '#fff',
          padding: 6,
        }}
      />
    </div>
  );
}

export default function QRPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const confirmSignOut = useConfirmSignOut();
  const [present] = useIonToast();
  const [showLoading, dismissLoading] = useIonLoading();

  const [branchId, setBranchId] = useState('');
  const [date, setDate] = useState(appToday());
  const [memberId, setMemberId] = useState('');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [active, setActive] = useState(false); // auto-rotating live QR
  const [secondsLeft, setSecondsLeft] = useState(0);

  const { data: settings } = useQuery({ queryKey: qk.settings, queryFn: getSettings });
  const { data: branches = [] } = useQuery({ queryKey: qk.branchOptions, queryFn: listBranchOptions });
  const requiresMember = !!settings?.qr_requires_member;
  const validity = Math.max(5, Number(settings?.qr_validity_seconds) || 25);

  const { data: memberPage } = useQuery({
    queryKey: ['qr-members', branchId],
    queryFn: () => listMemberPage({ branchId, page: 1, pageSize: 1000, search: '', field: 'name' }),
    enabled: !!branchId,
  });
  const members = memberPage?.items ?? [];

  // Changing any input stops the live QR (values would no longer match).
  useEffect(() => {
    setActive(false);
    setQrUrl(null);
  }, [branchId, date, memberId]);

  // Mint one fresh token + render its QR image. Returns its validity window.
  const mint = async (): Promise<number> => {
    const res = await createQr({ branch_id: branchId, date, member_id: memberId || null });
    const url = await QRCode.toDataURL(res.token, { width: 280, margin: 1 });
    setQrUrl(url);
    return res.validity_seconds ?? validity;
  };

  const start = async () => {
    if (!branchId) {
      present({ message: t('manager.pickBranch'), duration: TOAST_MS.medium, color: 'warning' });
      return;
    }
    if (requiresMember && !memberId) {
      present({ message: t('manager.pickMember'), duration: TOAST_MS.medium, color: 'warning' });
      return;
    }
    await showLoading({ message: t('common.processing') });
    try {
      const secs = await mint();
      setSecondsLeft(secs);
      setActive(true);
    } catch (e) {
      const msg = (e as Error).message === 'member_required' ? t('manager.pickMember') : t('common.error');
      present({ message: msg, duration: TOAST_MS.short, color: 'danger' });
    } finally {
      await dismissLoading();
    }
  };

  const stop = () => {
    setActive(false);
    setQrUrl(null);
  };

  // Manual "refresh now": mint a fresh token immediately and restart the timer.
  const refreshNow = async () => {
    try {
      const secs = await mint();
      setSecondsLeft(secs);
    } catch {
      present({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
    }
  };

  // Live countdown: tick every second; when it reaches 0, silently rotate to a
  // fresh token so a screenshot of the old code is already useless.
  useEffect(() => {
    if (!active) return;
    if (secondsLeft <= 0) {
      mint()
        .then((secs) => setSecondsLeft(secs))
        .catch(() => {
          present({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
          setActive(false);
        });
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, secondsLeft]);

  const branchName = branches.find((h) => h.id === branchId)?.name ?? '';
  const memberName = members.find((s) => s.member_id === memberId)?.full_name ?? '';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonMenuButton autoHide={true} />
          </IonButtons>
          <IonTitle>{t('manager.title')}</IonTitle>
          <IonButtons slot="end">
            <ThemeToggle />
            <LanguageToggle />
            <IonButton onClick={() => void confirmSignOut()}>
              <IonIcon slot="icon-only" icon={logOut} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          <ServerClock />
          <IonNote color="medium">{t('manager.welcome', { name: profile?.full_name ?? '' })}</IonNote>

          <div className="ui-surface ui-section" style={{ overflow: 'hidden' }}>
            <IonItem lines="full">
              <IonSelect
                label={t('admin.branch')}
                labelPlacement="stacked"
                placeholder={t('common.none')}
                value={branchId}
                onIonChange={(e) => setBranchId(e.detail.value)}
              >
                {branches.map((h) => (
                  <IonSelectOption key={h.id} value={h.id}>
                    {h.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <DateField label={t('attendance.date')} value={date} onChange={setDate} />
            <IonItem lines="none">
              <IonSelect
                label={requiresMember ? t('manager.member') : t('manager.memberOptional')}
                labelPlacement="stacked"
                placeholder={t('common.all')}
                value={memberId}
                onIonChange={(e) => setMemberId(e.detail.value)}
                disabled={!branchId}
              >
                {!requiresMember && <IonSelectOption value="">{t('common.all')}</IonSelectOption>}
                {members.map((s) => (
                  <IonSelectOption key={s.member_id} value={s.member_id}>
                    {s.full_name} · {s.national_id}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </div>

          {!active ? (
            <IonButton expand="block" onClick={start}>
              <IonIcon slot="start" icon={qrCodeOutline} />
              {t('manager.generate')}
            </IonButton>
          ) : (
            <IonButton expand="block" color="medium" fill="outline" onClick={stop}>
              {t('manager.stop')}
            </IonButton>
          )}

          {qrUrl && (
            <div className="ui-surface ui-section" style={{ textAlign: 'center', padding: 18 }}>
              <QrRing url={qrUrl} secondsLeft={secondsLeft} total={validity} />
              {active && (
                <div
                  className="ltr-nums"
                  style={{ marginTop: 12, fontWeight: 700, color: 'var(--ion-color-primary)' }}
                >
                  {t('manager.refreshesIn', { seconds: secondsLeft })}
                </div>
              )}
              <div className="ui-caption ltr-nums" style={{ marginTop: 10 }}>
                {branchName} · {formatDate(date)}
                {memberName ? ` · ${memberName}` : ''}
              </div>
              <IonLabel color="medium" className="ui-caption" style={{ display: 'block', marginTop: 6 }}>
                {t('manager.qrHint')}
              </IonLabel>
              <IonButton fill="clear" size="small" className="ion-margin-top" onClick={() => void refreshNow()}>
                <IonIcon slot="start" icon={refreshOutline} />
                {t('manager.refreshNow')}
              </IonButton>
            </div>
          )}
        </div>
        <Copyright />
      </IonContent>
    </IonPage>
  );
}
