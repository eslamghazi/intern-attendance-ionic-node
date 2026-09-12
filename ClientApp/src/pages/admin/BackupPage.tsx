import { useRef, useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonCheckbox,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSpinner,
  useIonToast,
} from '@ionic/react';
import {
  cloudDownloadOutline,
  cloudUploadOutline,
  personCircleOutline,
  shieldCheckmarkOutline,
  warningOutline,
} from 'ionicons/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../lib/usePermissions';
import AdminHeader from '../../components/AdminHeader';
import SectionHeader from '../../components/ui/SectionHeader';
import EmptyState from '../../components/ui/EmptyState';
import { useConfirm } from '../../components/ui/useConfirm';
import { TOAST_MS } from '../../lib/config';
import { formatDate } from '../../lib/date';
import {
  downloadSuperadminBackup,
  listSuperadmins,
  restoreSuperadmins,
  type RestoreResult,
} from '../../lib/api/superadmin';
import type { JsonValue } from '../../lib/json.types';

/**
 * Backing up and restoring the accounts that can do everything.
 *
 * WHY THIS PAGE EXISTS ALONGSIDE THE SCRIPTS
 *
 * `npm run superadmin:backup` needs a shell and the database URL, which is
 * exactly what the person who needs it usually does not have at the moment they
 * need it. Losing every superadmin locks an institution out of its own system,
 * and the fix should not require finding whoever set the server up.
 *
 * The file is byte-identical to the script's, in both directions.
 */
export default function BackupPage() {
  const { t } = useTranslation();
  const { superadmin, canOp } = usePermissions('backup');
  const confirm = useConfirm();
  const [toast] = useIonToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RestoreResult | null>(null);

  const { data: accounts = [], isLoading, refetch } = useQuery({
    queryKey: ['superadmin-accounts'],
    queryFn: listSuperadmins,
  });

  const fail = (err: unknown) =>
    toast({
      message: err instanceof Error ? err.message : t('common.error'),
      duration: TOAST_MS.long,
      color: 'danger',
    });

  const doBackup = async () => {
    setBusy(true);
    try {
      await downloadSuperadminBackup();
      toast({ message: t('backup.downloaded'), duration: TOAST_MS.short, color: 'success' });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear it straight away: picking the SAME file twice in a row fires no
    // change event otherwise, so a second attempt after a failure does nothing.
    e.target.value = '';
    if (!file) return;

    let parsed: JsonValue;
    try {
      parsed = JSON.parse(await file.text()) as JsonValue;
    } catch {
      return fail(new Error(t('backup.notJson')));
    }

    const ok = await confirm({
      header: t('backup.restoreTitle'),
      message: overwrite ? t('backup.confirmOverwrite') : t('backup.confirmRestore'),
      confirmText: t('backup.restore'),
    });
    if (!ok) return;

    setBusy(true);
    setResult(null);
    try {
      const res = await restoreSuperadmins(parsed, overwrite);
      setResult(res);
      await refetch();
      toast({
        message: t('backup.restored', { added: res.added, overwritten: res.overwritten }),
        duration: TOAST_MS.medium,
        color: 'success',
      });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const colorOf = (outcome: string) =>
    outcome === 'added' ? 'success' : outcome === 'overwritten' ? 'warning' : 'medium';

  return (
    <IonPage>
      <AdminHeader title={t('nav.backup')} />
      <IonContent className="ion-padding">
        {/* --- who can get in right now --- */}
        <SectionHeader title={t('backup.accounts')} />
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <IonSpinner />
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState icon={personCircleOutline} title={t('backup.noAccounts')} />
        ) : (
          <IonList inset>
            {accounts.map((a) => (
              <IonItem key={a.id}>
                <IonIcon slot="start" icon={shieldCheckmarkOutline} color="primary" />
                <IonLabel>
                  <h2>{a.full_name}</h2>
                  <p className="ltr-nums">{a.national_id}</p>
                </IonLabel>
                <IonNote slot="end">{formatDate(a.created_at)}</IonNote>
              </IonItem>
            ))}
          </IonList>
        )}

        {/* --- backup --- */}
        <SectionHeader title={t('backup.backupTitle')} />
        <div className="ui-surface ui-section" style={{ padding: 16 }}>
          <p className="ui-muted" style={{ marginTop: 0 }}>
            {t('backup.backupHelp')}
          </p>
          <IonNote color="warning" style={{ display: 'block', marginBottom: 12 }}>
            <IonIcon icon={warningOutline} /> {t('backup.secretWarning')}
          </IonNote>
          <IonButton expand="block" disabled={busy || !canOp('export')} onClick={doBackup}>
            <IonIcon slot="start" icon={cloudDownloadOutline} />
            {t('backup.download')}
          </IonButton>
        </div>

        {/* --- restore: superadmin only, whatever page is held. It creates
            superadmins, and a superadmin is only ever created by a superadmin. */}
        {superadmin && (
          <>
        <SectionHeader title={t('backup.restoreTitle')} />
        <div className="ui-surface ui-section" style={{ padding: 16 }}>
          <p className="ui-muted" style={{ marginTop: 0 }}>
            {t('backup.restoreHelp')}
          </p>

          <IonItem lines="none" style={{ '--padding-start': 0 } as React.CSSProperties}>
            <IonCheckbox
              checked={overwrite}
              onIonChange={(e) => setOverwrite(e.detail.checked)}
              labelPlacement="end"
            >
              {t('backup.overwrite')}
            </IonCheckbox>
          </IonItem>
          <IonNote style={{ display: 'block', marginBottom: 12 }}>
            {overwrite ? t('backup.overwriteOn') : t('backup.overwriteOff')}
          </IonNote>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={onFile}
          />
          <IonButton
            expand="block"
            fill="outline"
            color={overwrite ? 'warning' : 'primary'}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <IonIcon slot="start" icon={cloudUploadOutline} />
            {t('backup.chooseFile')}
          </IonButton>
        </div>
          </>
        )}

        {/* --- what the last restore did --- */}
        {result && (
          <>
            <SectionHeader title={t('backup.lastRestore')} />
            <IonList inset>
              {result.accounts.map((line) => (
                <IonItem key={line.national_id}>
                  <IonLabel>
                    <h2>{line.full_name}</h2>
                    <p className="ltr-nums">{line.national_id}</p>
                    {line.reason && <p className="ui-muted">{line.reason}</p>}
                  </IonLabel>
                  <IonBadge slot="end" color={colorOf(line.outcome)}>
                    {t(`backup.outcome.${line.outcome}`)}
                  </IonBadge>
                </IonItem>
              ))}
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
