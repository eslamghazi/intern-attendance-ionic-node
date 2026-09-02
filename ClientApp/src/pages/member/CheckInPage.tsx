import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  useIonAlert,
} from '@ionic/react';
import {
  checkmarkCircle,
  closeCircle,
  happy,
  qrCodeOutline,
  scan,
  settingsOutline,
} from 'ionicons/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthContext';
import { haversineMeters } from '../../lib/geo';
import { ensureLocationPermission, getLocation, openDeveloperSettings } from '../../lib/location/location';
import { captureFace } from '../../lib/face/camera';
import { getFaceAttrs, isSingleFrontalFace } from '../../lib/face/liveness';
import MemberHeader from '../../components/MemberHeader';
import LocationDiffMap from '../../components/ui/LocationDiffMap';
import QrScanner from '../../components/QrScanner';
import { ROUTES } from '../../lib/routes';
import { STATUS_COLOR } from '../../components/StatusBadge';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { bestSimilarity } from '../../lib/face/face';
import { getEnrolledEmbedding } from '../../lib/face/template';
import { useFaceModel } from '../../lib/face/useFaceModel';
import { blobToBase64, urlToBlob } from '../../lib/face/images';
import {
  AttendanceError,
  getDayAttendance,
  getDayShifts,
  recordAttendance,
  startQrBypass,
  type DayShift,
} from '../../lib/api/attendance';
import { getSettings } from '../../lib/api/settings';
import { checkinOpenNow, checkoutOpenNow, isOvernight } from '../../lib/shiftWindows';
import { appNowMinutes, appRealNow } from '../../lib/clock';
import { qk } from '../../lib/api/keys';
import { useServerToday } from '../../lib/useServerToday';
import { FACE, LOCATION } from '../../lib/config';

type Phase = 'ready' | 'locating' | 'capturing' | 'submitting' | 'done' | 'failed';

export default function CheckInPage() {
  const { t } = useTranslation();
  const { session, member, isEnrolled } = useAuth();
  const qc = useQueryClient();
  const [presentAlert] = useIonAlert();

  const [phase, setPhase] = useState<Phase>('ready');
  const [doneType, setDoneType] = useState<'check_in' | 'check_out' | null>(null);
  const [message, setMessage] = useState('');
  const [distance, setDistance] = useState<number | null>(null);
  const [locationFailed, setLocationFailed] = useState(false);
  // Member's GPS at the moment an out-of-range failure occurred, so we can plot
  // it against the branch geofence on a map.
  const [failedLoc, setFailedLoc] = useState<{ lat: number; lng: number } | null>(null);
  // True when the last failure was because Android Developer Options is enabled.
  const [devOptionsOn, setDevOptionsOn] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  // Timed location-bypass window unlocked by scanning a QR (epoch ms). The ref
  // mirrors the state so run() can read it synchronously right after a scan.
  const [bypassUntil, setBypassUntil] = useState(0);
  const bypassUntilRef = useRef(0);
  const setWindow = (until: number) => {
    bypassUntilRef.current = until;
    setBypassUntil(until);
  };
  const BYPASS_KEY = 'qr_bypass_until';

  // The QR bypass window is a REAL-TIME window: qr-bypass sets
  // location_bypass_until = real now + N min and record-attendance enforces it
  // against real server time. Compare against appRealNow() — the server-synced
  // REAL time — which is tamper-proof (can't be beaten by changing the device
  // clock) AND unaffected by a frozen test clock (unlike appNow()).
  // Restore any still-valid bypass window on open (survives a page reload).
  useEffect(() => {
    void Preferences.get({ key: BYPASS_KEY }).then(({ value }) => {
      const until = Number(value) || 0;
      if (until > appRealNow().getTime()) setWindow(until);
    });
  }, []);

  const bypassActive = bypassUntil > appRealNow().getTime();

  const branch = member?.branch;

  const { data: settings } = useQuery({
    queryKey: qk.settings,
    queryFn: getSettings,
  });

  // Effective check-in method = MOST RESTRICTIVE of global + branch (mirrors the
  // server enforcement in record-attendance).
  const gm = settings?.checkin_method ?? 'both';
  const branchBlocked = gm === 'none' || !!branch?.block_checkin;
  const branchRequireQr = gm === 'qr' || !!branch?.require_qr;
  const branchQrAllowed = (gm === 'qr' || gm === 'both') && branch?.qr_enabled !== false;

  // Preload the on-device face model (unless face is bypassed) so we can show a
  // "preparing face recognition" indicator instead of stalling on first capture.
  const faceBypassed = !!(
    settings?.bypass_face ||
    member?.bypass_face ||
    branch?.bypass_face ||
    member?.group?.bypass_face
  );
  const modelLoading =
    useFaceModel(!!isEnrolled && !faceBypassed && !branchBlocked) === 'loading';

  const serverToday = useServerToday();
  // Yesterday (Cairo) — a night shift (20:00 -> 08:00) is checked into on its
  // start day but checked OUT the next calendar day, so we also load yesterday's
  // record/shift to offer that overnight check-out.
  const serverYesterday = useMemo(() => {
    const d = new Date(`${serverToday}T12:00:00Z`); // noon avoids DST/rollover edge
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [serverToday]);

  const { data: todayAtt = [], isLoading: attLoading } = useQuery({
    queryKey: [...qk.memberToday(member?.id), serverToday],
    queryFn: () => getDayAttendance(member!.id, serverToday),
    enabled: !!member,
  });
  const { data: todayShifts = [], isLoading: shiftLoading } = useQuery({
    queryKey: [...qk.memberToday(member?.id), serverToday, 'shift'],
    queryFn: () => getDayShifts(member!.id, serverToday),
    enabled: !!member,
  });
  const { data: yAtt = [], isLoading: yAttLoading } = useQuery({
    queryKey: [...qk.memberToday(member?.id), serverYesterday],
    queryFn: () => getDayAttendance(member!.id, serverYesterday),
    enabled: !!member,
  });

  const enforce = settings?.enforce_shift_window ?? false;
  const nowMin = appNowMinutes();

  // Open records (checked in, not out) that can be checked OUT now: today's, plus
  // yesterday's still-open OVERNIGHT shifts (whose check-out is this morning).
  const openRecs = [
    ...todayAtt.filter((a) => a.check_in_at && !a.check_out_at),
    ...yAtt.filter((a) => a.check_in_at && !a.check_out_at && a.shift && isOvernight(a.shift)),
  ];
  // Rostered shifts not yet checked into today.
  const checkedInIds = new Set(todayAtt.filter((a) => a.check_in_at).map((a) => a.shift_id));
  const pendingShifts = todayShifts.filter((s) => !checkedInIds.has(s.id));

  // With enforcement, keep only the ones whose window is open right now.
  const openNow = openRecs.filter((r) => !enforce || (r.shift ? checkoutOpenNow(r.shift, nowMin) : true));
  const inNow = pendingShifts.filter((s) => !enforce || checkinOpenNow(s, nowMin));

  // Choose the current action + the shift it applies to. Check-OUT of an open
  // shift takes priority over checking IN the next one.
  let type: 'check_in' | 'check_out' | null = null;
  let activeShift: DayShift | null = null;
  if (openNow.length) {
    type = 'check_out';
    activeShift = openNow[0].shift;
  } else if (inNow.length) {
    type = 'check_in';
    activeShift = inNow[0];
  }

  const shiftLoadingAny = shiftLoading || attLoading || yAttLoading;
  const hasShift = todayShifts.length > 0 || openRecs.length > 0;
  // Everything for the day is settled (nothing pending to check in, nothing open).
  const allSettled = pendingShifts.length === 0 && openRecs.length === 0;
  // A shift exists but no window is open right now (only meaningful when enforcing).
  const windowClosed = !type && !allSettled;

  const threshold = settings?.face_match_threshold ?? FACE.defaultMatchThreshold;
  const livenessRequired = settings?.liveness_required ?? true;
  // Which proof of life the admin asked for: an expression, the head-turn 3D
  // check, or both (web camera only — the native camera is the OS one).
  const livenessMode = settings?.liveness_mode ?? 'turn';
  const maxAccuracy = settings?.max_accuracy_meters ?? LOCATION.defaultMaxAccuracyMeters;

  const fail = (reason: string, detail: Record<string, unknown> = {}) => {
    setPhase('failed');
    setMessage(reasonMessage(t, reason, detail));
  };

  const run = async (qrToken?: string) => {
    // `type` is only set when there IS an actionable shift whose window is open
    // (or when enforcement is off) — the server re-selects and re-validates the
    // exact shift by its open window, so the client sends nothing to pick.
    if (!type || !branch || !member || !session) return;
    // Per-branch hard stop (also enforced server-side in record-attendance).
    if (branch.block_checkin) return fail('branch_blocked');
    setMessage('');
    setLocationFailed(false);
    setFailedLoc(null);
    setDevOptionsOn(false);

    // Effective bypass = QR token OR active QR window OR global/member/branch/group.
    const bypassLocation =
      !!qrToken ||
      bypassUntilRef.current > appRealNow().getTime() || // real-time window (see note above)
      !!(
        settings?.bypass_location ||
        member.bypass_location ||
        member.branch?.bypass_location ||
        member.group?.bypass_location
      );
    const bypassFace = !!(
      settings?.bypass_face ||
      member.bypass_face ||
      member.branch?.bypass_face ||
      member.group?.bypass_face
    );
    const storeProbe = !!settings?.store_probe_images;

    // 1. Location + mock + geofence (skipped when location is bypassed).
    let lat = 0;
    let lng = 0;
    let accuracy = 0;
    let isMock = false;
    if (!bypassLocation) {
      setPhase('locating');
      // A location failure lets the member fall back to a manager's QR code.
      const locFail = (reason: string, detail: Record<string, unknown> = {}) => {
        setLocationFailed(true);
        fail(reason, detail);
      };
      if (!(await ensureLocationPermission())) return locFail('noPermission');
      const loc = await getLocation({
        ipMaxKm: settings?.location_ip_max_km,
        detectFrozen: settings?.web_detect_frozen_gps,
      }).catch(() => null);
      if (!loc) return locFail('noPermission');
      if (loc.isMock) return locFail('mock');
      // Developer Options is the switch that enables mock-location apps — block
      // it (unless an admin disabled this gate) before trusting the coordinates.
      if (settings?.block_dev_options !== false && loc.devMode) {
        setDevOptionsOn(true);
        return locFail('dev_options');
      }
      const dist = Math.round(haversineMeters(loc.lat, loc.lng, branch.latitude, branch.longitude));
      setDistance(dist);
      if (dist > branch.radius_meters) {
        setFailedLoc({ lat: loc.lat, lng: loc.lng });
        return locFail('out_of_range', { distance: dist, radius: branch.radius_meters });
      }
      if (loc.accuracy > maxAccuracy) return locFail('low_accuracy', { accuracy: Math.round(loc.accuracy) });
      lat = loc.lat;
      lng = loc.lng;
      accuracy = loc.accuracy;
      isMock = loc.isMock;
    }

    // 2. Face capture / match / liveness (skipped when face is bypassed).
    let score = 1;
    let livenessPassed = true;
    let probeWebPath: string | null = null;
    if (!bypassFace) {
      setPhase('capturing');
      // ONE liveness check, done inside the camera (a random action challenge)
      // while capturing the face used for matching.
      let cap1;
      try {
        cap1 = await captureFace(
          {
            guide: t('camera.faceGuide'),
            liveness: {
              blink: t('camera.chBlink'),
              smile: t('camera.chSmile'),
              mouthOpen: t('camera.chMouth'),
              browUp: t('camera.chBrow'),
            },
            tips: {
              loading: t('camera.tipLoading'),
              closer: t('camera.tipCloser'),
              center: t('camera.tipCenter'),
              dark: t('camera.tipDark'),
              manyFaces: t('camera.tipManyFaces'),
            },
            turn: {
              hold: t('camera.chTurnHold'),
              turn: t('camera.chTurn'),
              back: t('camera.chTurnBack'),
              failed: t('camera.chTurnFailed'),
            },
          },
          livenessRequired,
          (settings?.capture_hold_seconds ?? 3) * 1000,
          livenessMode,
        );
      } catch {
        return fail('error');
      }
      if (!cap1) return setPhase('ready'); // user cancelled the camera
      probeWebPath = cap1.webPath;
      const a1 = await getFaceAttrs(cap1.path);
      if (!isSingleFrontalFace(a1)) return fail('liveness');

      try {
        const enrolled = await getEnrolledEmbedding(member.id);
        if (!enrolled) return fail('not_enrolled');
        // Compare against both the face and its mirror, keep the better score —
        // so a left/right orientation difference between enrollment and check-in
        // never causes a false mismatch.
        score = (await bestSimilarity(cap1.webPath, enrolled)).score;
      } catch {
        return fail('error');
      }
      if (score < threshold) return fail('face_mismatch');

      // Liveness was confirmed by the in-camera challenge (single check).
      livenessPassed = livenessRequired ? true : livenessPassed;
    }

    // 3. Optional probe image — sent as base64 so the server stores it under an
    // organized, code-named path (only when the admin enabled probe storage).
    setPhase('submitting');
    let probeBase64: string | null = null;
    if (storeProbe && probeWebPath) {
      try {
        const blob = await urlToBlob(probeWebPath);
        probeBase64 = await blobToBase64(blob);
      } catch {
        probeBase64 = null; // non-fatal
      }
    }

    try {
      await recordAttendance({
        type,
        lat,
        lng,
        accuracy,
        is_mock: isMock,
        liveness_passed: livenessPassed,
        face_score: score,
        probe_base64: probeBase64,
        qr_token: qrToken ?? null,
        // Integrity marker: present only on the installed native app. When the
        // "require device integrity" setting is on, this gates check-in to the
        // native app (a browser sends null → rejected). Full Play Integrity /
        // App Attest verification is a native follow-up.
        integrity_token: Capacitor.isNativePlatform() ? 'native-app' : null,
      });
      // Remember the action that JUST completed — after invalidation, `type`
      // flips to the next action (check_out), so the success message must NOT
      // read the live `type`.
      setDoneType(type);
      setPhase('done');
      void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
      await qc.invalidateQueries({ queryKey: qk.memberToday(member.id) });
      await qc.invalidateQueries({ queryKey: qk.memberHistory(member.id) });
    } catch (e) {
      const err = e as AttendanceError;
      fail(err.reason, err.detail);
    }
  };

  // A scanned QR unlocks a timed location-bypass window (server-enforced), then
  // we proceed with the check-in — and the window keeps location bypassed for
  // check-out / retries until it expires.
  const activateBypass = async (token: string) => {
    try {
      const res = await startQrBypass(token);
      const until = new Date(res.until).getTime();
      setWindow(until);
      await Preferences.set({ key: BYPASS_KEY, value: String(until) });
      presentAlert({
        header: t('checkin.bypassActiveTitle'),
        message: t('checkin.bypassActive', { minutes: res.minutes }),
        buttons: [t('common.ok')],
      });
      await run();
    } catch {
      fail('qr_invalid');
    }
  };

  const busy = phase === 'locating' || phase === 'capturing' || phase === 'submitting';
  const title = type === 'check_out' ? t('checkin.titleOut') : t('checkin.title');

  return (
    <IonPage>
      <MemberHeader title={title} />
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 460, margin: '0 auto', textAlign: 'center' }}>
          {!isEnrolled ? (
            <div className="ion-margin-top">
              <IonIcon icon={happy} color="primary" style={{ fontSize: 72 }} />
              <h2>{t('checkin.enrollFirstTitle')}</h2>
              <IonText color="medium">
                <p>{t('checkin.enrollFirstHint')}</p>
              </IonText>
              <IonButton expand="block" className="ion-margin-top" routerLink={ROUTES.enroll}>
                <IonIcon slot="start" icon={scan} />
                {t('checkin.goEnroll')}
              </IonButton>
            </div>
          ) : (
          <>
          <Stepper phase={phase} t={t} />

          {phase === 'done' && (
            <div className="ion-margin-top">
              <IonIcon icon={checkmarkCircle} color="success" style={{ fontSize: 72 }} />
              <h2>{doneType === 'check_out' ? t('checkin.successOut') : t('checkin.success')}</h2>
              {distance != null && (
                <IonText color="medium">
                  <p>{t('checkin.locationOk', { distance })}</p>
                </IonText>
              )}
            </div>
          )}

          {phase === 'failed' && (
            <div className="ion-margin-top">
              <IonIcon icon={closeCircle} color="danger" style={{ fontSize: 72 }} />
              <IonText color="danger">
                <p>{message}</p>
              </IonText>
              {devOptionsOn && (
                <IonButton
                  fill="outline"
                  size="small"
                  className="ion-margin-top"
                  onClick={() => void openDeveloperSettings()}
                >
                  <IonIcon slot="start" icon={settingsOutline} />
                  {t('checkin.openDevSettings')}
                </IonButton>
              )}
              {failedLoc && branch && settings?.show_out_of_range_map !== false && (
                <div className="ion-margin-top" style={{ textAlign: 'start' }}>
                  <LocationDiffMap
                    me={failedLoc}
                    target={{ lat: branch.latitude, lng: branch.longitude }}
                    radius={branch.radius_meters}
                    distance={distance ?? 0}
                    area={branch.area_coords}
                  />
                  <p className="ui-caption" style={{ textAlign: 'center', marginTop: 6 }}>
                    {t('checkin.mapLegend')}
                  </p>
                </div>
              )}
            </div>
          )}

          {busy && (
            <div className="ion-margin-top">
              <IonSpinner name="crescent" />
              <p>
                {phase === 'locating' && t('checkin.locating')}
                {phase === 'capturing' && t('checkin.faceMatching')}
                {phase === 'submitting' && t('checkin.submitting')}
              </p>
            </div>
          )}

          {bypassActive && (
            <IonText color="success" className="ion-margin-top" style={{ display: 'block' }}>
              <p className="ui-caption">{t('checkin.bypassActiveHint')}</p>
            </IonText>
          )}

          {branchBlocked && (phase === 'ready' || phase === 'failed') && (
            <div className="ion-margin-top" style={{ textAlign: 'center' }}>
              <IonIcon icon={closeCircle} color="danger" style={{ fontSize: 56 }} />
              <IonText color="danger">
                <p>{t('checkin.branchBlocked')}</p>
              </IonText>
            </div>
          )}

          {!branchBlocked && (phase === 'ready' || phase === 'failed') &&
          (!shiftLoadingAny && !hasShift ? (
            <IonText color="medium" className="ion-margin-top">
              <p style={{ textAlign: 'center' }}>{t('member.noShiftToday')}</p>
            </IonText>
          ) : allSettled ? (
            <IonText color="medium" className="ion-margin-top">
              <p>{t('checkin.alreadyCheckedOut')}</p>
            </IonText>
          ) : windowClosed ? (
            <IonText color="medium" className="ion-margin-top">
              <p style={{ textAlign: 'center' }}>{t('checkin.noShiftOpenNow')}</p>
            </IonText>
          ) : (
            (phase === 'ready' || phase === 'failed') && (
              <>
                {/* Which shift this action applies to (matters with 2+ shifts). */}
                {activeShift && (
                  <IonText color="medium" className="ion-margin-top" style={{ display: 'block', textAlign: 'center' }}>
                    <p className="ui-caption">
                      {t(type === 'check_in' ? 'checkin.forShiftIn' : 'checkin.forShiftOut', {
                        shift: activeShift.name,
                      })}
                    </p>
                  </IonText>
                )}
                {/* This branch requires a QR scan — the location button can't
                    authorize on its own until a QR window is active. */}
                {branchRequireQr && !bypassActive && (
                  <IonText color="medium" className="ion-margin-top" style={{ display: 'block', textAlign: 'center' }}>
                    <p className="ui-caption">{t('checkin.qrRequiredHint')}</p>
                  </IonText>
                )}
                {/* Face model is still downloading — surface it, don't stall. */}
                {modelLoading && (
                  <IonText color="medium" className="ion-margin-top" style={{ display: 'block', textAlign: 'center' }}>
                    <IonSpinner name="dots" />
                    <p className="ui-caption">{t('checkin.loadingModel')}</p>
                  </IonText>
                )}
                <IonButton
                  expand="block"
                  className="ion-margin-top"
                  onClick={() => run()}
                  disabled={busy || modelLoading || (branchRequireQr && !bypassActive)}
                >
                  <IonIcon slot="start" icon={scan} />
                  {phase === 'failed' ? t('common.retry') : title}
                </IonButton>
                {/* QR scan is an alternative to the location check — hidden
                    while a bypass window is active, or when this branch disallows QR. */}
                {branchQrAllowed && !bypassActive && (
                  <IonButton
                    expand="block"
                    fill="outline"
                    className="ion-margin-top"
                    disabled={busy}
                    onClick={() => setScanOpen(true)}
                  >
                    <IonIcon slot="start" icon={qrCodeOutline} />
                    {t('checkin.scanQr')}
                  </IonButton>
                )}
                {locationFailed && (
                  <IonText color="medium" className="ion-margin-top" style={{ display: 'block', textAlign: 'center' }}>
                    <p className="ui-caption">{t('checkin.scanQrHint')}</p>
                  </IonText>
                )}
              </>
            )
          ))}
          </>
          )}
        </div>

        <IonModal isOpen={scanOpen} onDidDismiss={() => setScanOpen(false)}>
          <IonHeader>
            <IonToolbar color="primary">
              <IonTitle>{t('checkin.scanQr')}</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setScanOpen(false)}>{t('common.cancel')}</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonText color="medium">
              <p style={{ textAlign: 'center' }}>{t('checkin.scanQrHint')}</p>
            </IonText>
            {scanOpen && (
              <QrScanner
                onScan={(token) => {
                  setScanOpen(false);
                  void activateBypass(token);
                }}
                onError={() => setScanOpen(false)}
                allowImage={settings?.qr_allow_image ?? true}
              />
            )}
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}

function Stepper({ phase, t }: { phase: Phase; t: (k: string) => string }) {
  const labels = ['stepLocation', 'stepFace', 'stepLiveness', 'stepDone'];
  const idx =
    phase === 'done' ? 3 : phase === 'submitting' ? 2 : phase === 'capturing' ? 1 : 0;
  const green = STATUS_COLOR.present.solid;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 4px 22px' }}>
      {labels.map((key, i) => {
        const done = i < idx || phase === 'done';
        const active = i === idx && phase !== 'done';
        const ring = done ? green : active ? 'var(--ion-color-primary)' : 'var(--app-hairline)';
        return (
          <div key={key} style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                width: 30,
                height: 30,
                margin: '0 auto',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: done ? green : active ? 'var(--ion-color-primary)' : 'transparent',
                border: `2px solid ${ring}`,
                color: done || active ? '#fff' : 'var(--ion-color-medium)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {done ? '✓' : i + 1}
            </div>
            <div
              style={{
                fontSize: 11,
                marginTop: 6,
                color: active ? 'var(--ion-color-primary)' : 'var(--ion-color-medium)',
              }}
            >
              {t(`checkin.${key}`)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function reasonMessage(
  t: (k: string, o?: Record<string, unknown>) => string,
  reason: string,
  detail: Record<string, unknown>,
): string {
  switch (reason) {
    case 'branch_blocked':
      return t('checkin.branchBlocked');
    case 'checkout_blocked':
      return t('checkin.checkoutBlocked');
    case 'qr_disabled':
      return t('checkin.qrDisabled');
    case 'qr_required':
      return t('checkin.qrRequired');
    case 'mock':
      return t('checkin.mockDetected');
    case 'dev_options':
      return t('checkin.devOptions');
    case 'out_of_range':
      return t('checkin.outOfRange', { distance: detail.distance, radius: detail.radius });
    case 'low_accuracy':
      return t('checkin.lowAccuracy', { accuracy: detail.accuracy });
    case 'noPermission':
      return t('checkin.noPermission');
    case 'liveness':
      return t('checkin.livenessFailed');
    case 'face_mismatch':
      return t('checkin.faceMismatch');
    case 'not_enrolled':
      return t('checkin.notEnrolled');
    case 'outside_shift':
      return t('checkin.outsideShift');
    case 'already_checked_in':
      return t('checkin.alreadyCheckedIn');
    case 'already_checked_out':
      return t('checkin.alreadyCheckedOut');
    case 'integrity_failed':
      return t('checkin.rejected', { reason: 'integrity' });
    case 'qr_invalid':
      return t('checkin.qrInvalid');
    case 'outside_window':
      return t('checkin.outsideWindow');
    case 'checkin_closed':
      return t('checkin.checkinClosed');
    case 'checkout_closed':
      return t('checkin.checkoutClosed');
    case 'not_checked_in':
      return t('checkin.notCheckedIn');
    case 'not_rostered':
      return t('member.noShiftToday');
    default:
      return t('common.error');
  }
}
