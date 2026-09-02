import { useRef, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonPage,
} from '@ionic/react';
import { cameraOutline, keyOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthContext';
import { updateMyProfile, uploadAvatar } from '../../lib/api/profile';
import { ROUTES } from '../../lib/routes';
import AdminHeader from '../../components/AdminHeader';
import Avatar from '../../components/ui/Avatar';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import { useFeedback } from '../../components/ui/useFeedback';

/** A staff member (admin/manager/superadmin) edits their own profile + photo,
 *  and can open the password change. National ID is read-only for staff (it is
 *  tied to their sign-in). */
export default function AdminProfilePage() {
  const { t } = useTranslation();
  const { profile, refresh } = useAuth();
  const fb = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(profile?.avatar_url ?? null);
  const [pwOpen, setPwOpen] = useState(false);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setAvatarBlob(f);
    setPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!profile || !fullName.trim()) return;
    const res = await fb.run(
      async () => {
        let avatar_url = profile.avatar_url ?? null;
        if (avatarBlob) avatar_url = await uploadAvatar(profile.id, avatarBlob);
        await updateMyProfile({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          national_id: profile.national_id, // unchanged (tied to sign-in)
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
      <AdminHeader title={t('nav.profile')} backHref={ROUTES.admin.dashboard} />
      <IonContent className="ion-padding">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, margin: '8px 0 18px' }}>
          <Avatar name={fullName} src={preview} size={104} />
          <IonButton fill="clear" size="small" onClick={() => fileRef.current?.click()}>
            <IonIcon slot="start" icon={cameraOutline} />
            {t('profile.changePhoto')}
          </IonButton>
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
              readonly
              value={profile?.national_id ?? ''}
            />
            <IonNote slot="end" className="ui-caption">
              {t('roles.' + (profile?.role ?? 'admin'))}
            </IonNote>
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

        <IonButton expand="block" className="ion-margin-top" onClick={save} disabled={!fullName.trim()}>
          {t('common.save')}
        </IonButton>
        <IonButton expand="block" fill="outline" className="ion-margin-top" onClick={() => setPwOpen(true)}>
          <IonIcon slot="start" icon={keyOutline} />
          {t('auth.changePassword')}
        </IonButton>
      </IonContent>
      <ChangePasswordModal isOpen={pwOpen} onClose={() => setPwOpen(false)} />
    </IonPage>
  );
}
