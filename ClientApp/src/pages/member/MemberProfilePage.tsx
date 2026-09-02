import { useRef, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
} from '@ionic/react';
import { cameraOutline, keyOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthContext';
import { useBranding } from '../../lib/branding';
import { updateMyProfile, uploadAvatar } from '../../lib/api/profile';
import { ROUTES } from '../../lib/routes';
import MemberHeader from '../../components/MemberHeader';
import Avatar from '../../components/ui/Avatar';
import { useFeedback } from '../../components/ui/useFeedback';

export default function MemberProfilePage() {
  const { t } = useTranslation();
  const { profile, member, refresh } = useAuth();
  const { memberPhotos } = useBranding();
  const fb = useFeedback();
  const institution = member?.group?.institution?.name ?? member?.group?.institution_name ?? null;
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [nationalId, setNationalId] = useState(profile?.national_id ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(profile?.avatar_url ?? null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setAvatarBlob(f);
    setPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!profile || !fullName.trim() || !nationalId.trim()) return;
    const res = await fb.run(
      async () => {
        let avatar_url = profile.avatar_url ?? null;
        if (avatarBlob) avatar_url = await uploadAvatar(profile.id, avatarBlob);
        await updateMyProfile({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          national_id: nationalId.trim(),
          avatar_url,
        });
        await refresh();
      },
      { success: t('common.saved') },
    );
    if (res !== undefined) setAvatarBlob(null);
  };

  return (
    <IonPage>
      <MemberHeader title={t('nav.profile')} />
      <IonContent className="ion-padding">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, margin: '8px 0 18px' }}>
          <Avatar name={fullName} src={preview} size={104} />
          {memberPhotos && (
            <IonButton fill="clear" size="small" onClick={() => fileRef.current?.click()}>
              <IonIcon slot="start" icon={cameraOutline} />
              {t('profile.changePhoto')}
            </IonButton>
          )}
        </div>

        <IonList inset>
          <IonItem>
            <IonInput
              label={t('admin.fullName')}
              labelPlacement="stacked"
              value={fullName}
              onIonInput={(e) => setFullName(e.detail.value ?? '')}
            />
          </IonItem>
          <IonItem>
            <IonInput
              label={t('auth.nationalId')}
              labelPlacement="stacked"
              className="ltr-nums"
              inputmode="numeric"
              value={nationalId}
              onIonInput={(e) => setNationalId(e.detail.value ?? '')}
            />
          </IonItem>
          <IonItem>
            <IonInput
              label={t('admin.phone')}
              labelPlacement="stacked"
              className="ltr-nums"
              inputmode="tel"
              value={phone}
              onIonInput={(e) => setPhone(e.detail.value ?? '')}
            />
          </IonItem>
          <IonItem>
            <IonInput
              label={t('admin.email')}
              labelPlacement="stacked"
              className="ltr-nums"
              type="email"
              value={email}
              onIonInput={(e) => setEmail(e.detail.value ?? '')}
            />
          </IonItem>
        </IonList>

        {/* Assigned by the admin — shown for reference, not editable. */}
        <div className="ui-caption" style={{ padding: '10px 16px 4px' }}>{t('member.assignedInfo')}</div>
        <IonList inset>
          <IonItem>
            <IonLabel>{t('admin.institutionName')}</IonLabel>
            <IonNote slot="end">{institution ?? '—'}</IonNote>
          </IonItem>
          <IonItem>
            <IonLabel>{t('member.yourBranch')}</IonLabel>
            <IonNote slot="end">{member?.branch?.name ?? '—'}</IonNote>
          </IonItem>
          <IonItem>
            <IonLabel>{t('member.yourGroup')}</IonLabel>
            <IonNote slot="end">{member?.group?.name ?? '—'}</IonNote>
          </IonItem>
        </IonList>

        <IonButton
          expand="block"
          className="ion-margin-top"
          onClick={save}
          disabled={!fullName.trim() || !nationalId.trim()}
        >
          {t('common.save')}
        </IonButton>
        <IonButton
          expand="block"
          fill="outline"
          className="ion-margin-top"
          routerLink={ROUTES.member.changePassword}
        >
          <IonIcon slot="start" icon={keyOutline} />
          {t('auth.changePassword')}
        </IonButton>
      </IonContent>
    </IonPage>
  );
}
