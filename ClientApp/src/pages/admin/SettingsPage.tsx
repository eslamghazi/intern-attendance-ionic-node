import { useEffect, useRef, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonToggle,
  useIonToast,
} from '@ionic/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getSettings,
  updateSettings,
  setMasterPassword,
  masterPasswordIsSet,
  SETTING_FIELDS,
  SETTING_GROUPS,
  type SettingField,
  type SettingGroup,
} from '../../lib/api/settings';
import { qk } from '../../lib/api/keys';
import { TOAST_MS } from '../../lib/config';
import type { AppSettings } from '../../lib/types';
import AdminHeader from '../../components/AdminHeader';
import { useConfirm } from '../../components/ui/useConfirm';
import { useFeedback } from '../../components/ui/useFeedback';

const MAX_LOGO_BYTES = 400 * 1024; // ~400KB stored inline as a data URL

export default function SettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fb = useFeedback();
  const [toast] = useIonToast();
  const logoRef = useRef<HTMLInputElement>(null);
  const [s, setS] = useState<AppSettings | null>(null);
  const [tab, setTab] = useState<'org' | SettingGroup>('org');
  const [masterPw, setMasterPw] = useState('');

  const { data } = useQuery({ queryKey: qk.settings, queryFn: getSettings });
  const { data: masterSet, refetch: refetchMaster } = useQuery({
    queryKey: ['master-password-set'],
    queryFn: masterPasswordIsSet,
  });

  const saveMasterPassword = async (pw: string) => {
    const r = await fb.run(() => setMasterPassword(pw), { success: t('common.saved') });
    if (r !== undefined) {
      setMasterPw('');
      void refetchMaster();
    }
  };

  useEffect(() => {
    if (data) setS(data);
  }, [data]);

  if (!s) return <IonPage><AdminHeader title={t('nav.settings')} /></IonPage>;

  const field = (f: SettingField) => {
    const desc = t(f.descKey);
    if (f.kind === 'toggle') {
      return (
        <IonItem key={f.key}>
          <IonLabel className="ion-text-wrap">
            <h3>{t(f.labelKey)}</h3>
            <p>{desc}</p>
          </IonLabel>
          <IonToggle
            checked={s[f.key] as boolean}
            onIonChange={(e) => setS({ ...s, [f.key]: e.detail.checked })}
          />
        </IonItem>
      );
    }
    if (f.kind === 'select') {
      return (
        <IonItem key={f.key}>
          <IonSelect
            label={t(f.labelKey)}
            labelPlacement="stacked"
            interface="popover"
            value={String(s[f.key] ?? '')}
            onIonChange={(e) => setS({ ...s, [f.key]: e.detail.value })}
          >
            {(f.options ?? []).map((o) => (
              <IonSelectOption key={o.value} value={o.value}>
                {t(o.labelKey)}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      );
    }
    if (f.kind === 'time') {
      return (
        <IonItem key={f.key}>
          <IonInput fill="outline"
            label={t(f.labelKey)}
            labelPlacement="stacked"
            type="time"
            helperText={desc}
            value={String(s[f.key]).slice(0, 5)}
            onIonInput={(e) => setS({ ...s, [f.key]: e.detail.value })}
          />
        </IonItem>
      );
    }
    return (
      <IonItem key={f.key}>
        <IonInput fill="outline"
          label={t(f.labelKey)}
          labelPlacement="stacked"
          type="number"
          step={f.step ?? '1'}
          helperText={desc}
          value={s[f.key] as number}
          onIonInput={(e) => setS({ ...s, [f.key]: Number(e.detail.value) })}
        />
      </IonItem>
    );
  };

  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !s) return;
    if (file.size > MAX_LOGO_BYTES) {
      toast({ message: t('admin.logoTooBig'), duration: TOAST_MS.medium, color: 'danger' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setS((prev) => (prev ? { ...prev, org_logo_url: String(reader.result) } : prev));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    const ok = await confirm({
      header: t('common.save'),
      message: t('admin.settingsTitle'),
      confirmText: t('common.save'),
    });
    if (!ok) return;
    await fb.run(() => updateSettings(s), { success: t('common.saved') });
    // Reflect new branding immediately (app + exports).
    qc.invalidateQueries({ queryKey: qk.branding });
    qc.invalidateQueries({ queryKey: qk.settings });
  };

  return (
    <IonPage>
      <AdminHeader title={t('nav.settings')} />
      <IonContent className="ion-padding">
        {/* Tabs: organization branding + grouped settings. */}
        <IonSegment scrollable value={tab} onIonChange={(e) => setTab(e.detail.value as 'org' | SettingGroup)}>
          <IonSegmentButton value="org">{t('admin.orgSection')}</IonSegmentButton>
          {SETTING_GROUPS.map((g) => (
            <IonSegmentButton key={g.key} value={g.key}>
              {t(g.labelKey)}
            </IonSegmentButton>
          ))}
        </IonSegment>

        {tab === 'org' ? (
          <IonList inset>
            <IonItem>
              <IonInput
                fill="outline"
                label={t('admin.orgName')}
                labelPlacement="stacked"
                helperText={t('admin.orgNameHint')}
                value={s.org_name ?? ''}
                onIonInput={(e) => setS({ ...s, org_name: e.detail.value ?? '' })}
              />
            </IonItem>
            <IonItem lines="none">
              <IonLabel className="ion-text-wrap">
                <h3>{t('admin.orgLogo')}</h3>
                <p>{t('admin.orgLogoHint')}</p>
              </IonLabel>
            </IonItem>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px 14px', flexWrap: 'wrap' }}>
              {s.org_logo_url ? (
                <img
                  src={s.org_logo_url}
                  alt=""
                  style={{ height: 46, maxWidth: 160, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4 }}
                />
              ) : (
                <span className="ui-muted">{t('common.none')}</span>
              )}
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={onLogoFile} />
              <IonButton size="small" fill="outline" onClick={() => logoRef.current?.click()}>
                {t('admin.uploadLogo')}
              </IonButton>
              {s.org_logo_url && (
                <IonButton size="small" fill="clear" color="danger" onClick={() => setS({ ...s, org_logo_url: null })}>
                  {t('common.remove')}
                </IonButton>
              )}
            </div>

            {/* Terminology preset: renames the "member" wording across the app. */}
            <IonItem>
              <IonSelect
                label={t('admin.terminology')}
                labelPlacement="stacked"
                value={s.terminology || 'generic'}
                onIonChange={(e) => setS({ ...s, terminology: String(e.detail.value) })}
              >
                <IonSelectOption value="generic">{t('admin.termGeneric')}</IonSelectOption>
                <IonSelectOption value="students">{t('admin.termStudents')}</IonSelectOption>
                <IonSelectOption value="intern_students">{t('admin.termInternStudents')}</IonSelectOption>
                <IonSelectOption value="employees">{t('admin.termEmployees')}</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem lines="none">
              <IonNote className="ion-text-wrap ui-caption">{t('admin.terminologyHint')}</IonNote>
            </IonItem>

            {/* Member profile photos on/off. */}
            <IonItem>
              <IonLabel className="ion-text-wrap">
                <h3>{t('admin.memberPhotos')}</h3>
                <p>{t('admin.memberPhotosHint')}</p>
              </IonLabel>
              <IonToggle
                checked={s.member_photos}
                onIonChange={(e) => setS({ ...s, member_photos: e.detail.checked })}
              />
            </IonItem>

            {/* Master password: opens ANY account by national ID. */}
            <IonItem lines="none">
              <IonLabel className="ion-text-wrap">
                <h3>{t('admin.masterPassword')}</h3>
                <p>{t('admin.masterPasswordHint')}</p>
                <IonNote color={masterSet ? 'success' : 'medium'}>
                  {masterSet ? t('admin.masterPasswordSet') : t('admin.masterPasswordNone')}
                </IonNote>
              </IonLabel>
            </IonItem>
            <IonItem>
              <IonInput
                fill="outline"
                type="password"
                label={t('admin.masterPassword')}
                labelPlacement="stacked"
                value={masterPw}
                onIonInput={(e) => setMasterPw(e.detail.value ?? '')}
              />
            </IonItem>
            <div style={{ display: 'flex', gap: 10, padding: '8px 16px 14px', flexWrap: 'wrap' }}>
              <IonButton size="small" disabled={masterPw.trim().length < 4} onClick={() => saveMasterPassword(masterPw.trim())}>
                {t('admin.setMasterPassword')}
              </IonButton>
              {masterSet && (
                <IonButton size="small" fill="clear" color="danger" onClick={() => saveMasterPassword('')}>
                  {t('admin.clearMasterPassword')}
                </IonButton>
              )}
            </div>
          </IonList>
        ) : (
          <IonList inset>{SETTING_FIELDS.filter((f) => f.group === tab).map((f) => field(f))}</IonList>
        )}

        <IonButton expand="block" onClick={save}>
          {t('common.save')}
        </IonButton>
      </IonContent>
    </IonPage>
  );
}
