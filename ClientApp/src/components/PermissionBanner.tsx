import { useEffect, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { warningOutline } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { useTranslation } from 'react-i18next';
import {
  promptPermissions,
  recheckPermissions,
  requestStartupPermissions,
  type PermissionStatus,
} from '../lib/permissions/startup';

/** Which how-to-enable guide fits the current platform. */
function guideKey(): 'nativeIos' | 'nativeAndroid' | 'ios' | 'android' | 'desktop' {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() === 'ios' ? 'nativeIos' : 'nativeAndroid';
  }
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/**
 * A persistent bar pinned to the top of the screen whenever a required
 * permission (camera / location) is missing. "Allow" re-requests; if that fails
 * (permanently denied), a "How to enable" button opens a detailed per-platform
 * guide in a modal so the bar itself stays short.
 */
export default function PermissionBanner() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const [triedGrant, setTriedGrant] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    void requestStartupPermissions().then(setStatus);
    const onFocus = () => void recheckPermissions().then(setStatus);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  if (!status) return null;
  const missing: string[] = [];
  if (!status.camera) missing.push(t('permReq.camera'));
  if (!status.location) missing.push(t('permReq.location'));
  if (!missing.length) return null;

  const grant = async () => {
    const st = await promptPermissions();
    setStatus(st);
    // If it didn't help, the browser has denied it permanently — offer the guide.
    if (!st.camera || !st.location) setTriedGrant(true);
  };

  const steps = t(`permReq.guide.${guideKey()}`)
    .split('\n')
    .filter((s) => s.trim());

  return (
    <>
      <div className="perm-banner" role="alert">
        <IonIcon icon={warningOutline} />
        <span>{t('permReq.missing', { list: missing.join('، ') })}</span>
        {triedGrant ? (
          <button type="button" className="perm-banner__btn" onClick={() => setGuideOpen(true)}>
            {t('permReq.howTo')}
          </button>
        ) : (
          <button type="button" className="perm-banner__btn" onClick={grant}>
            {t('permReq.grant')}
          </button>
        )}
      </div>

      <IonModal isOpen={guideOpen} onDidDismiss={() => setGuideOpen(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{t('permReq.guideTitle')}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setGuideOpen(false)}>{t('common.close')}</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <p style={{ marginTop: 0 }}>{t('permReq.guideIntro')}</p>
          <ol className="perm-guide">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <IonButton
            expand="block"
            className="ion-margin-top"
            onClick={async () => {
              const st = await recheckPermissions();
              setStatus(st);
              if (st.camera && st.location) setGuideOpen(false);
            }}
          >
            {t('permReq.recheck')}
          </IonButton>
        </IonContent>
      </IonModal>
    </>
  );
}
