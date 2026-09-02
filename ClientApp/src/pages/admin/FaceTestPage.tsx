import { useEffect, useRef, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
  useIonToast,
} from '@ionic/react';
import { alertCircleOutline, cameraOutline, checkmarkCircle, imageOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import AdminHeader from '../../components/AdminHeader';
import MemberPicker from '../../components/admin/MemberPicker';
import SectionHeader from '../../components/ui/SectionHeader';
import { getSettings } from '../../lib/api/settings';
import { qk } from '../../lib/api/keys';
import { BUCKETS, FACE, TOAST_MS } from '../../lib/config';
import { captureFace } from '../../lib/face/camera';
import { bestSimilarity, isModelReady } from '../../lib/face/face';
import { signedUrl } from '../../lib/face/images';
import { getEnrolledEmbedding, listFacePhotos } from '../../lib/face/template';
import type { MemberPageItem } from '../../lib/api/members';

interface TestResult {
  ok: boolean;
  score: number;
  threshold: number;
  /** The photo that was just tested. */
  probeUrl: string;
}

/**
 * Check a photo against a member's stored face print — "is this really them?".
 *
 * It runs the SAME comparison check-in runs (both orientations, the admin's own
 * threshold), so the verdict here predicts what will happen at the door. It only
 * reads: no template is written and no attendance is recorded.
 */
export default function FaceTestPage() {
  const { t } = useTranslation();
  const [present] = useIonToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<MemberPageItem[]>([]);
  const member = selected[0] ?? null;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  /** The on-device AI model is a few MB — say so instead of just disabling. */
  const [modelState, setModelState] = useState<'loading' | 'ready' | 'error'>('loading');

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

  // The member's enrolled photo, shown next to the test shot so the admin can
  // also judge with their own eyes.
  const { data: enrolledUrl } = useQuery({
    queryKey: ['face-test-enrolled', member?.member_id],
    enabled: !!member,
    queryFn: async () => {
      const rows = await listFacePhotos([member!.member_id]);
      const path = rows[0]?.photo_path;
      return path ? await signedUrl(BUCKETS.faces, path) : null;
    },
  });

  const { data: settings } = useQuery({ queryKey: qk.settings, queryFn: getSettings });
  const threshold = settings?.face_match_threshold ?? FACE.defaultMatchThreshold;

  const toast = (message: string, color = 'danger') =>
    present({ message, duration: TOAST_MS.medium, color });

  /** Compare one image URL against the selected member's stored template. */
  const runTest = async (probeUrl: string) => {
    if (!member) return;
    setBusy(true);
    try {
      const enrolled = await getEnrolledEmbedding(member.member_id);
      if (!enrolled) {
        toast(t('admin.faceTestNotEnrolled'), 'warning');
        return;
      }
      const { score } = await bestSimilarity(probeUrl, enrolled);
      setResult({ ok: score >= threshold, score, threshold, probeUrl });
    } catch (e) {
      toast((e as Error)?.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const onCapture = async () => {
    setResult(null);
    const cap = await captureFace({
      guide: t('camera.faceGuide'),
      tips: {
        loading: t('camera.tipLoading'),
        closer: t('camera.tipCloser'),
        center: t('camera.tipCenter'),
        dark: t('camera.tipDark'),
      },
    }).catch(() => null);
    if (cap) await runTest(cap.webPath);
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    await runTest(URL.createObjectURL(file));
    if (fileRef.current) fileRef.current.value = ''; // allow re-picking the same file
  };

  const canTest = !!member && modelState === 'ready' && !busy;

  return (
    <IonPage>
      <AdminHeader title={t('nav.faceTest')} />
      <IonContent>
        <IonText color="medium">
          <p className="ui-caption" style={{ padding: '10px 14px 0' }}>{t('admin.faceTestPageHint')}</p>
        </IonText>

        <SectionHeader title={t('admin.pickMember')} />
        <MemberPicker selected={selected} onChange={(next) => { setSelected(next); setResult(null); }} />

        <div className="ion-padding">
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

          <IonButton expand="block" disabled={!canTest} onClick={() => void onCapture()}>
            <IonIcon slot="start" icon={cameraOutline} />
            {t('admin.faceTestCapture')}
          </IonButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void onPickFile(e.target.files?.[0])}
          />
          <IonButton
            expand="block"
            fill="outline"
            disabled={!canTest}
            onClick={() => fileRef.current?.click()}
          >
            <IonIcon slot="start" icon={imageOutline} />
            {t('admin.faceTestUpload')}
          </IonButton>

          {busy && (
            <div style={{ textAlign: 'center', padding: 12 }}>
              <IonSpinner name="crescent" />
            </div>
          )}

          {result && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 14px',
                  marginTop: 12,
                  borderRadius: 12,
                  fontWeight: 700,
                  textAlign: 'center',
                  color: result.ok ? 'var(--ion-color-success)' : 'var(--ion-color-danger)',
                  background: result.ok ? 'rgba(45,211,111,0.12)' : 'rgba(235,68,90,0.12)',
                }}
              >
                <IonIcon icon={result.ok ? checkmarkCircle : alertCircleOutline} />
                <span>
                  {t(result.ok ? 'admin.faceTestMatch' : 'admin.faceTestNoMatch', {
                    name: member?.full_name ?? '',
                    score: Math.round(result.score * 100),
                    threshold: Math.round(result.threshold * 100),
                  })}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'center' }}>
                <figure style={{ margin: 0, textAlign: 'center' }}>
                  <img
                    src={result.probeUrl}
                    alt=""
                    style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: 12 }}
                  />
                  <figcaption className="ui-caption">{t('admin.faceTestShot')}</figcaption>
                </figure>
                <figure style={{ margin: 0, textAlign: 'center' }}>
                  {enrolledUrl ? (
                    <img
                      src={enrolledUrl}
                      alt=""
                      style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: 12 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 150,
                        height: 150,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(128,128,128,0.16)',
                      }}
                    >
                      <IonNote className="ui-caption">{t('admin.faceNoStoredPhoto')}</IonNote>
                    </div>
                  )}
                  <figcaption className="ui-caption">{t('admin.faceTestEnrolled')}</figcaption>
                </figure>
              </div>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
