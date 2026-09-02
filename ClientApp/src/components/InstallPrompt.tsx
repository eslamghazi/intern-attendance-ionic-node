import { useEffect, useState } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { close, downloadOutline, shareOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa_install_dismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** True if the app is already installed (Chrome exposes getInstalledRelatedApps). */
async function isInstalled(): Promise<boolean> {
  if (isStandalone()) return true;
  try {
    const nav = navigator as unknown as {
      getInstalledRelatedApps?: () => Promise<unknown[]>;
    };
    if (nav.getInstalledRelatedApps) {
      const apps = await nav.getInstalledRelatedApps();
      if (apps.length > 0) return true;
    }
  } catch {
    /* not supported */
  }
  return false;
}

/** Prompts the user to install the app as a PWA. On Android/desktop Chrome it
 *  uses the native beforeinstallprompt; on iOS Safari (no such event) it shows a
 *  short "Add to Home Screen" hint. Hidden once installed / running standalone. */
export default function InstallPrompt() {
  const { t } = useTranslation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    // Already installed (standalone or a matching installed PWA) or previously
    // dismissed → never nag again.
    if (localStorage.getItem(DISMISS_KEY)) {
      setDismissed(true);
      return;
    }
    let cancelled = false;
    void isInstalled().then((installed) => {
      if (installed && !cancelled) setDismissed(true);
    });

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setDismissed(true);
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt — show the manual hint instead.
    if (isIos() && !isStandalone()) setShowIos(true);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (dismissed || isStandalone()) return null;
  if (!deferred && !showIos) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    const e = deferred;
    setDeferred(null);
    await e.prompt();
    const choice = await e.userChoice.catch(() => undefined);
    if (choice?.outcome === 'accepted') dismiss();
  };

  return (
    <div className="install-banner">
      <img src="/logo.svg" width={36} height={36} alt="" />
      <div className="install-banner__text">
        <strong>{t('pwa.installTitle')}</strong>
        <span>{deferred ? t('pwa.installHint') : t('pwa.iosHint')}</span>
      </div>
      {deferred ? (
        <IonButton size="small" onClick={install}>
          <IonIcon slot="start" icon={downloadOutline} />
          {t('pwa.install')}
        </IonButton>
      ) : (
        <IonIcon icon={shareOutline} style={{ fontSize: 22, color: 'var(--ion-color-primary)' }} />
      )}
      <button
        type="button"
        className="install-banner__close"
        onClick={dismiss}
        aria-label={t('common.close')}
      >
        <IonIcon icon={close} />
      </button>
    </div>
  );
}
