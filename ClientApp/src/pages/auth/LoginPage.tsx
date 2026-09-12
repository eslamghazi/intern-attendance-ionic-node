import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonList,
  IonPage,
  IonText,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { NATIONAL_ID_LENGTH } from '../../lib/config';
import { useAuth } from '../../lib/auth/AuthContext';
import { useBranding } from '../../lib/branding';
import LanguageToggle from '../../components/LanguageToggle';
import ThemeToggle from '../../components/ThemeToggle';
import PoweredBy from '../../components/PoweredBy';

export default function LoginPage() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const brand = useBranding();
  const [nationalId, setNationalId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    const { error: err } = await signIn(nationalId.trim(), password);
    setBusy(false);
    if (err) setError(t(`auth.${err}`));
    // On success, the auth state change re-routes automatically.
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div
          style={{ position: 'absolute', insetInlineEnd: 8, top: 8, display: 'flex', alignItems: 'center' }}
        >
          <ThemeToggle />
          <LanguageToggle />
        </div>

        <div style={{ maxWidth: 420, margin: '12vh auto 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            {/* App identity (always) */}
            <img src="/logo.svg" alt="" style={{ height: 56, marginBottom: 8 }} />
            <h1
              style={{
                color: 'var(--ion-color-primary)',
                margin: '0 0 2px',
                fontSize: '1.4rem',
                fontWeight: 700,
              }}
            >
              {t('common.appName')}
            </h1>
            {/* Organization identity (the customer), when set */}
            {brand.hasOrg && (
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: '1px solid var(--app-hairline)',
                }}
              >
                <img
                  src={brand.logo}
                  alt=""
                  style={{ height: 52, maxWidth: 200, objectFit: 'contain', marginBottom: 6 }}
                />
                <div style={{ fontWeight: 700 }}>{brand.name}</div>
              </div>
            )}
          </div>

          <IonList inset>
            <IonItem>
              <IonInput fill="outline"
                label={t('auth.nationalId')}
                labelPlacement="stacked"
                inputmode="numeric"
                maxlength={NATIONAL_ID_LENGTH}
                value={nationalId}
                onIonInput={(e) => setNationalId(e.detail.value ?? '')}
                className="ltr-nums"
              />
            </IonItem>
            <IonItem>
              <IonInput fill="outline"
                label={t('auth.password')}
                labelPlacement="stacked"
                type="password"
                value={password}
                onIonInput={(e) => setPassword(e.detail.value ?? '')}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              >
                <IonInputPasswordToggle slot="end" />
              </IonInput>
            </IonItem>
          </IonList>

          {error && (
            <IonText color="danger">
              <p style={{ textAlign: 'center' }}>{error}</p>
            </IonText>
          )}

          <IonButton
            expand="block"
            className="ion-margin-top"
            onClick={submit}
            disabled={busy || !nationalId || !password}
          >
            {t('auth.signIn')}
          </IonButton>

          <PoweredBy />
        </div>
      </IonContent>
    </IonPage>
  );
}
