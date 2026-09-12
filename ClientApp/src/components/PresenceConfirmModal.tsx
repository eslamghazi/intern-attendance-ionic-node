import { useState } from 'react';
import { IonButton, IonContent, IonIcon, IonModal, IonSpinner, IonText } from '@ionic/react';
import { checkmarkCircle, handRightOutline } from 'ionicons/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { confirmPresence, pollPresence } from '../lib/api/presence';
import { getSettings } from '../lib/api/settings';
import { qk } from '../lib/api/keys';
import { useAuth } from '../lib/auth/AuthContext';
import { verifyMemberFace } from '../lib/face/verify';
import { formatTime } from '../lib/date';
import { useFeedback } from './ui/useFeedback';

/**
 * Polls for a surprise presence spot-check targeting the logged-in member and,
 * when one is pending, shows a blocking modal to confirm they're present. Mounted
 * once in the member shell so it appears on any member screen.
 */
export default function PresenceConfirmModal() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fb = useFeedback();
  const { member } = useAuth();
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ['presence-poll'],
    queryFn: pollPresence,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const pending = data?.pending ?? null;
  const { data: settings } = useQuery({ queryKey: qk.settings, queryFn: getSettings });

  // Face is required to confirm — exactly like check-in — unless it's bypassed.
  const bypassFace = !!(
    settings?.bypass_face ||
    member?.bypass_face ||
    member?.branch?.bypass_face ||
    member?.group?.bypass_face
  );

  const confirm = async () => {
    if (!pending || !member) return;
    setBusy(true);
    try {
      if (!bypassFace) {
        const res = await verifyMemberFace(member.id, t);
        if (!res.ok) {
          if (res.reason !== 'cancelled') {
            fb.toast(t(`presence.face_${res.reason}`), 'danger');
          }
          return;
        }
      }
      await confirmPresence(pending.check_id);
      fb.toast(t('presence.confirmed'), 'success');
      await qc.invalidateQueries({ queryKey: ['presence-poll'] });
    } catch {
      fb.toast(t('common.error'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonModal isOpen={!!pending} backdropDismiss={false}>
      <IonContent className="ion-padding">
        <div style={{ textAlign: 'center', paddingTop: 28, maxWidth: 420, margin: '0 auto' }}>
          <IonIcon icon={handRightOutline} color="warning" style={{ fontSize: 68 }} />
          <h2>{t('presence.confirmTitle')}</h2>
          <IonText color="medium">
            <p>{t('presence.confirmBody')}</p>
          </IonText>
          {pending && (
            <IonText color="danger">
              <p className="ui-caption">{t('presence.confirmDeadline', { time: formatTime(pending.deadline) })}</p>
            </IonText>
          )}
          <IonButton expand="block" className="ion-margin-top" onClick={confirm} disabled={busy}>
            {busy ? <IonSpinner name="crescent" /> : <IonIcon slot="start" icon={checkmarkCircle} />}
            {t('presence.confirmBtn')}
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
}
