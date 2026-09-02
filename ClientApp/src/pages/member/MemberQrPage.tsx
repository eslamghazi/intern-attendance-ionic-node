import { useEffect, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonLabel,
  IonNote,
  IonPage,
  useIonLoading,
  useIonToast,
} from '@ionic/react';
import { qrCodeOutline, refreshOutline } from 'ionicons/icons';
import QRCode from 'qrcode';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthContext';
import { createQr } from '../../lib/api/admin';
import { getSettings } from '../../lib/api/settings';
import { qk } from '../../lib/api/keys';
import { TOAST_MS } from '../../lib/config';
import { formatDate } from '../../lib/date';
import { appToday } from '../../lib/clock';
import MemberHeader from '../../components/MemberHeader';
import QrRing from '../../components/ui/QrRing';

/** A trusted member generates a location-bypass QR for their OWN branch
 *  (server-enforced) so colleagues whose GPS fails can still check in. */
export default function MemberQrPage() {
  const { t } = useTranslation();
  const { member } = useAuth();
  const [present] = useIonToast();
  const [showLoading, dismissLoading] = useIonLoading();

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const { data: settings } = useQuery({ queryKey: qk.settings, queryFn: getSettings });
  const validity = Math.max(5, Number(settings?.qr_validity_seconds) || 25);
  const today = appToday();

  const mint = async (): Promise<number> => {
    // Server ignores branch_id for members and locks to their own branch.
    const res = await createQr({ branch_id: member?.branch_id ?? '', date: today, member_id: null });
    const url = await QRCode.toDataURL(res.token, { width: 280, margin: 1 });
    setQrUrl(url);
    return res.validity_seconds ?? validity;
  };

  const start = async () => {
    await showLoading({ message: t('common.processing') });
    try {
      const secs = await mint();
      setSecondsLeft(secs);
      setActive(true);
    } catch {
      present({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
    } finally {
      await dismissLoading();
    }
  };
  const stop = () => {
    setActive(false);
    setQrUrl(null);
  };
  const refreshNow = async () => {
    try {
      setSecondsLeft(await mint());
    } catch {
      present({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
    }
  };

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

  return (
    <IonPage>
      <MemberHeader title={t('nav.qr')} />
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          <IonNote color="medium" style={{ display: 'block' }}>
            {t('manager.qrHint')}
          </IonNote>
          <div className="ui-surface ui-section" style={{ padding: 14 }}>
            <div className="ui-row">
              <span className="ui-muted">{t('member.yourBranch')}</span>
              <span style={{ fontWeight: 600 }}>{member?.branch?.name ?? '—'}</span>
            </div>
            <div className="ui-row">
              <span className="ui-muted">{t('attendance.date')}</span>
              <span className="ltr-nums" style={{ fontWeight: 600 }}>{formatDate(today)}</span>
            </div>
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
                <div className="ltr-nums" style={{ marginTop: 12, fontWeight: 700, color: 'var(--ion-color-primary)' }}>
                  {t('manager.refreshesIn', { seconds: secondsLeft })}
                </div>
              )}
              <IonLabel color="medium" className="ui-caption" style={{ display: 'block', marginTop: 6 }}>
                {member?.branch?.name} · {formatDate(today)}
              </IonLabel>
              <IonButton fill="clear" size="small" className="ion-margin-top" onClick={() => void refreshNow()}>
                <IonIcon slot="start" icon={refreshOutline} />
                {t('manager.refreshNow')}
              </IonButton>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
