import { useEffect, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import { alertCircleOutline, camera, checkmarkCircle, scanOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthContext';
import { useConfirmSignOut } from '../../lib/auth/useConfirmSignOut';
import { markEnrolled } from '../../lib/api/profile';
import { getMemberIdByProfile } from '../../lib/api/members';
import { apiFetch } from '../../lib/api/http';
import { FACE, TOAST_MS } from '../../lib/config';
import { getSettings } from '../../lib/api/settings';
import { captureFace } from '../../lib/face/camera';
import { getFaceAttrs } from '../../lib/face/liveness';
import { bestSimilarity, EMBEDDING_DIM, getEmbedding, isModelReady } from '../../lib/face/face';
import { blobToBase64, urlToBlob } from '../../lib/face/images';
import { getEnrolledEmbedding, saveEnrolledEmbedding } from '../../lib/face/template';

export default function FaceEnrollmentPage() {
  const { t } = useTranslation();
  const { session, member, isEnrolled, refresh } = useAuth();
  const confirmSignOut = useConfirmSignOut();
  const [preview, setPreview] = useState<string | null>(null);
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [modelState, setModelState] = useState<'loading' | 'ready' | 'error'>('loading');
  const modelReady = modelState === 'ready';
  /** Result of "does my saved face print still recognise me?" */
  const [testResult, setTestResult] = useState<{ ok: boolean; score: number; threshold: number } | null>(
    null,
  );
  const [present] = useIonToast();
  const [presentAlert] = useIonAlert();

  // Warm up (download + init) the on-device AI model as soon as the page opens,
  // showing a loader; capture/upload stay disabled until it's ready.
  useEffect(() => {
    let alive = true;
    setModelState('loading');
    isModelReady()
      .then((ok) => alive && setModelState(ok ? 'ready' : 'error'))
      .catch(() => alive && setModelState('error'));
    return () => {
      alive = false;
    };
  }, []);

  const toast = (message: string, color = 'danger') =>
    present({ message, duration: TOAST_MS.medium, color });

  // Show the FULL error (message + details + hint + code) in a dismissible alert.
  const errText = (e: unknown): string => {
    if (typeof e === 'string') return e;
    const x = (e ?? {}) as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [x.message, x.details, x.hint, x.code ? `code: ${x.code}` : ''].filter(Boolean);
    return parts.length ? parts.join('\n') : JSON.stringify(e);
  };
  const showError = (message: string) =>
    presentAlert({ header: t('common.error'), message, buttons: [t('common.ok')] });

  // Shared: run liveness/face-count checks + compute the embedding for an image.
  const processImage = async (webPath: string, nativePath: string) => {
    const attrs = await getFaceAttrs(nativePath);
    if (attrs.available && attrs.count === 0) {
      showError(t('auth.enrollNoFace'));
      return;
    }
    if (attrs.available && attrs.count > 1) {
      showError(t('auth.enrollMultipleFaces'));
      return;
    }
    const emb = await getEmbedding(webPath);
    setPreview(webPath);
    setEmbedding(emb);
  };

  const runImage = async (fn: () => Promise<{ webPath: string; path: string } | null>) => {
    setBusy(true);
    try {
      const cap = await fn();
      if (cap) await processImage(cap.webPath, cap.path);
    } catch (e) {
      const msg = (e as Error)?.message;
      showError(msg === 'model_unavailable' ? 'Face model not available on this device.' : errText(e));
    } finally {
      setBusy(false);
    }
  };

  const cameraLabels = () => ({
    guide: t('camera.faceGuide'),
    tips: {
      loading: t('camera.tipLoading'),
      closer: t('camera.tipCloser'),
      center: t('camera.tipCenter'),
      dark: t('camera.tipDark'),
      manyFaces: t('camera.tipManyFaces'),
    },
  });

  const onCapture = () => runImage(async () => await captureFace(cameraLabels()));

  /** The member's own id, re-fetched if the auth bundle didn't hydrate it. */
  const resolveMemberId = async (): Promise<string | null> => {
    if (member?.id) return member.id;
    if (!session) return null;
    return (await getMemberIdByProfile(session.user.id)).id;
  };

  /**
   * Check the SAVED face print against a fresh photo and say plainly whether it
   * recognises the person holding the phone — the same comparison check-in runs,
   * at the same threshold, so "it works here" means "it will work at check-in".
   * Nothing is written: this only reads the stored template.
   */
  const onTestFace = async () => {
    setTestResult(null);
    const memberId = await resolveMemberId();
    if (!memberId) return showError(t('auth.faceTestNoTemplate'));
    setBusy(true);
    try {
      const enrolled = await getEnrolledEmbedding(memberId);
      if (!enrolled) return showError(t('auth.faceTestNoTemplate'));
      const cap = await captureFace(cameraLabels());
      if (!cap) return; // camera cancelled
      setPreview(cap.webPath);
      // Compare against the face and its mirror, exactly like check-in does.
      const { score } = await bestSimilarity(cap.webPath, enrolled);
      const settings = await getSettings().catch(() => null);
      const threshold = settings?.face_match_threshold ?? FACE.defaultMatchThreshold;
      setTestResult({ ok: score >= threshold, score, threshold });
    } catch (e) {
      showError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!embedding || !preview) return showError(t('auth.enrollNoFace'));
    if (!session) return showError('No active session. Please log in again.');
    if (embedding.length !== EMBEDDING_DIM) {
      return showError(`Face model produced ${embedding.length} dimensions, expected ${EMBEDDING_DIM}.`);
    }
    // The context member can be null if the profile bundle didn't hydrate (embed
    // error / RLS / stale cache). Re-fetch the row directly rather than dead-end.
    let memberId = member?.id ?? null;
    if (!memberId) {
      const r = await getMemberIdByProfile(session.user.id);
      if (r.id) memberId = r.id;
      else
        return showError(
          r.error
            ? `Could not load your profile record: ${r.error}`
            : 'Your profile is still loading. Please log out and back in.',
        );
    }
    setBusy(true);
    try {
      // The embedding is the essential part — save it first.
      await saveEnrolledEmbedding(memberId, embedding, null, null);
      await markEnrolled();
      // Then store the enrollment PHOTO in an admin-browsable location
      // (faces/<group>/<member_code>.jpg) via the service role. Best-effort:
      // a failed/undeployed photo store must never fail the enrollment itself.
      try {
        const blob = await urlToBlob(preview);
        const image_base64 = await blobToBase64(blob);
        await apiFetch('/face/enroll-photo', { method: 'POST', body: { image_base64 } });
      } catch (imgErr) {
        console.warn('enrollment photo store failed (embedding saved):', imgErr);
      }
      toast(t('auth.enrollSaved'), 'success');
      await refresh();
    } catch (e) {
      console.error('enroll save failed:', e);
      showError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>{t('auth.enrollTitle')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => void confirmSignOut()}>{t('common.logout')}</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
          <IonText color="medium">
            <p>{t('auth.enrollHint')}</p>
          </IonText>

          {/* Current state: does this member already have a face print? */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 999,
              fontWeight: 600,
              fontSize: '0.9rem',
              margin: '4px auto 8px',
              color: isEnrolled ? 'var(--ion-color-success)' : 'var(--ion-color-medium)',
              background: isEnrolled ? 'rgba(45,211,111,0.12)' : 'rgba(128,128,128,0.12)',
            }}
          >
            <IonIcon icon={isEnrolled ? checkmarkCircle : alertCircleOutline} />
            {t(isEnrolled ? 'auth.enrollStatusEnrolled' : 'auth.enrollStatusNot')}
          </div>

          <div
            style={{
              position: 'relative',
              width: 220,
              height: 220,
              margin: '16px auto',
              borderRadius: '50%',
              overflow: 'hidden',
              background: 'rgba(128,128,128,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid var(--ion-color-primary)',
            }}
          >
            {preview ? (
              <img src={preview} alt="face" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <IonIcon icon={camera} style={{ fontSize: 64, color: 'var(--ion-color-medium)' }} />
            )}
            {busy && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'rgba(0,0,0,0.45)',
                  color: '#fff',
                }}
              >
                <IonSpinner name="crescent" style={{ transform: 'scale(1.4)' }} />
                <span style={{ fontSize: '0.85rem' }}>{t('common.processing')}</span>
              </div>
            )}
          </div>

          {isEnrolled ? (
            // Once enrolled, the member may NOT change their own face print —
            // only an admin can reset it, after which this page re-enables. They
            // CAN test it, though, to find out before a shift whether it still
            // recognises them.
            <>
              <IonText color="medium">
                <p style={{ fontSize: '0.92rem' }}>{t('auth.enrollLockedNote')}</p>
              </IonText>
              {modelState === 'loading' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: '10px 0',
                    color: 'var(--ion-color-medium)',
                  }}
                >
                  <IonSpinner name="crescent" />
                  <span>{t('auth.enrollLoadingModel')}</span>
                </div>
              )}
              {modelState === 'error' && (
                <IonText color="danger">
                  <p className="ui-caption">{t('admin.faceModelFailed')}</p>
                </IonText>
              )}
              <IonButton
                expand="block"
                fill="outline"
                disabled={busy || !modelReady}
                onClick={() => void onTestFace()}
              >
                <IonIcon slot="start" icon={scanOutline} />
                {t('auth.faceTest')}
              </IonButton>
              <IonText color="medium">
                <p className="ui-caption">{t('auth.faceTestHint')}</p>
              </IonText>
              {testResult && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 12,
                    fontWeight: 600,
                    color: testResult.ok ? 'var(--ion-color-success)' : 'var(--ion-color-danger)',
                    background: testResult.ok ? 'rgba(45,211,111,0.12)' : 'rgba(235,68,90,0.12)',
                  }}
                >
                  <IonIcon icon={testResult.ok ? checkmarkCircle : alertCircleOutline} />
                  <span>
                    {t(testResult.ok ? 'auth.faceTestMatch' : 'auth.faceTestNoMatch', {
                      score: Math.round(testResult.score * 100),
                      threshold: Math.round(testResult.threshold * 100),
                    })}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              {!modelReady ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: '14px 0',
                    color:
                      modelState === 'error' ? 'var(--ion-color-danger)' : 'var(--ion-color-medium)',
                  }}
                >
                  {modelState === 'loading' && <IonSpinner name="crescent" />}
                  <span>
                    {t(modelState === 'error' ? 'admin.faceModelFailed' : 'auth.enrollLoadingModel')}
                  </span>
                </div>
              ) : (
                <IonButton expand="block" fill="outline" onClick={onCapture} disabled={busy}>
                  <IonIcon slot="start" icon={camera} />
                  {preview ? t('auth.enrollRetake') : t('auth.enrollCapture')}
                </IonButton>
              )}

              <IonButton expand="block" onClick={onSave} disabled={busy || !embedding}>
                <IonIcon slot="start" icon={checkmarkCircle} />
                {t('auth.enrollSave')}
              </IonButton>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
