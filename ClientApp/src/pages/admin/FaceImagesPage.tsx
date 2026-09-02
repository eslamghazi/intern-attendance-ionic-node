import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonNote,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSpinner,
  IonText,
  useIonAlert,
  useIonLoading,
  useIonToast,
} from '@ionic/react';
import { archiveOutline, downloadOutline, openOutline, trashOutline } from 'ionicons/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import AdminHeader from '../../components/AdminHeader';
import MemberPicker from '../../components/admin/MemberPicker';
import EmptyState from '../../components/ui/EmptyState';
import SectionHeader from '../../components/ui/SectionHeader';
import { listAllProbePaths, listProbeImages } from '../../lib/api/attendance';
import { listAllFacePhotoPaths, listFacePhotos } from '../../lib/face/template';
import {
  downloadImage,
  downloadImagesZip,
  removeImages,
  signedUrls,
} from '../../lib/face/images';
import { usePermissions } from '../../lib/usePermissions';
import { BUCKETS, TOAST_MS } from '../../lib/config';
import { appToday } from '../../lib/clock';
import { formatDateTime } from '../../lib/date';
import type { MemberPageItem } from '../../lib/api/members';

type Mode = 'attendance' | 'faceprint';

interface Tile {
  key: string;
  memberName: string;
  caption: string;
  url: string;
  /** Where the file actually lives, so it can be deleted. */
  path: string;
}

/** yyyy-mm-dd, n days back from today. */
function daysAgo(n: number): string {
  const d = new Date(`${appToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Browse the biometric images the system stored: the check-in / check-out shots
 * for chosen days, or each member's enrolled face print.
 *
 * Both buckets are private; nothing here is a public link — every tile is a
 * short-lived signed URL, minted in one batch per view.
 */
export default function FaceImagesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { canOp, superadmin } = usePermissions('faceImages');
  const [present] = useIonToast();
  const [presentAlert] = useIonAlert();
  const [showLoading, dismissLoading] = useIonLoading();
  const [selected, setSelected] = useState<MemberPageItem[]>([]);
  const [mode, setMode] = useState<Mode>('attendance');
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(appToday());

  const ids = selected.map((m) => m.member_id);
  const nameOf = (id: string) => selected.find((m) => m.member_id === id)?.full_name ?? '';

  const { data: tiles = [], isFetching } = useQuery({
    queryKey: ['face-images', mode, ids.join(','), from, to],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Tile[]> => {
      if (mode === 'faceprint') {
        const rows = await listFacePhotos(ids);
        const urls = await signedUrls(
          BUCKETS.faces,
          rows.map((r) => r.photo_path ?? '').filter(Boolean),
        );
        // Only members that actually HAVE a stored photo — an empty frame for
        // everyone else is noise, not information.
        return rows.flatMap((r) => {
          const url = r.photo_path ? urls.get(r.photo_path) : undefined;
          return url
            ? [
                {
                  key: r.member_id,
                  memberName: nameOf(r.member_id),
                  caption: formatDateTime(r.created_at),
                  url,
                  path: r.photo_path!,
                },
              ]
            : [];
        });
      }
      const probes = await listProbeImages({ memberIds: ids, from, to });
      const urls = await signedUrls(
        BUCKETS.probes,
        probes.map((p) => p.path),
      );
      // Same rule here: a path whose file is gone yields no tile.
      return probes.flatMap((p) => {
        const url = urls.get(p.path);
        if (!url) return [];
        return [
          {
            key: `${p.member_id}|${p.date}|${p.type}|${p.path}`,
            memberName: nameOf(p.member_id),
            caption: [
              t(p.type === 'check_in' ? 'admin.checkIn' : 'admin.checkOut'),
              p.date,
              p.shift_name ?? '',
              p.face_score != null ? `${Math.round(p.face_score * 100)}%` : '',
            ]
              .filter(Boolean)
              .join(' · '),
            url,
            path: p.path,
          },
        ];
      });
    },
  });

  const bucket = mode === 'faceprint' ? BUCKETS.faces : BUCKETS.probes;
  const refresh = () => qc.invalidateQueries({ queryKey: ['face-images'] });

  /** Delete files, with a loader and a count in the toast. */
  const deletePaths = async (paths: string[]) => {
    if (!paths.length) return;
    await showLoading({ message: t('common.processing') });
    try {
      const removed = await removeImages(bucket, paths);
      refresh();
      present({
        message: t('admin.imagesDeleted', { count: removed }),
        duration: TOAST_MS.long,
        color: 'success',
      });
    } catch (e) {
      present({
        message: (e as Error)?.message || t('common.error'),
        duration: TOAST_MS.medium,
        color: 'danger',
      });
    } finally {
      await dismissLoading();
    }
  };

  /** Every destructive action asks first, and says exactly how many files it is
   *  about to remove — biometric images are not recoverable. */
  const confirmDelete = (message: string, paths: string[]) =>
    presentAlert({
      header: t('admin.deleteImages'),
      message,
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('common.confirm'),
          role: 'destructive',
          handler: () => void deletePaths(paths),
        },
      ],
    });

  /** Save one image to the device. */
  const exportOne = async (tile: Tile) => {
    await showLoading({ message: t('common.processing') });
    try {
      await downloadImage(bucket, tile.path, `${tile.memberName} - ${tile.path.split('/').pop()}`);
    } catch (e) {
      present({
        message: (e as Error)?.message || t('common.error'),
        duration: TOAST_MS.medium,
        color: 'danger',
      });
    } finally {
      await dismissLoading();
    }
  };

  /** Save everything currently listed as one zip, a folder per member. */
  const exportListed = async () => {
    if (!tiles.length) return;
    await showLoading({ message: t('common.processing') });
    try {
      const count = await downloadImagesZip(
        bucket,
        tiles.map((x) => ({ path: x.path, folder: x.memberName })),
        `${mode === 'faceprint' ? 'face-prints' : 'attendance-photos'}_${appToday()}.zip`,
      );
      present({
        message: count
          ? t('admin.imagesExported', { count })
          : t('admin.noStoredImages'),
        duration: TOAST_MS.long,
        color: count ? 'success' : 'warning',
      });
    } catch (e) {
      present({
        message: (e as Error)?.message || t('common.error'),
        duration: TOAST_MS.medium,
        color: 'danger',
      });
    } finally {
      await dismissLoading();
    }
  };

  /** Empty the whole store for this mode — every member, every date, not just
   *  what the current filter shows. Superadmin only. */
  const emptyAll = async () => {
    await showLoading({ message: t('common.processing') });
    let paths: string[] = [];
    try {
      paths = mode === 'faceprint' ? await listAllFacePhotoPaths() : await listAllProbePaths();
    } catch {
      paths = [];
    } finally {
      await dismissLoading();
    }
    if (!paths.length) {
      present({ message: t('admin.noStoredImages'), duration: TOAST_MS.medium, color: 'warning' });
      return;
    }
    confirmDelete(t('admin.emptyImagesConfirm', { count: paths.length }), paths);
  };

  return (
    <IonPage>
      <AdminHeader title={t('nav.faceImages')} />
      <IonContent>
        <IonText color="medium">
          <p className="ui-caption" style={{ padding: '10px 14px 0' }}>
            {t('admin.faceImagesHint')}
          </p>
        </IonText>

        <SectionHeader title={t('admin.pickMember')} />
        <MemberPicker selected={selected} onChange={setSelected} multiple />

        <div style={{ padding: '12px 12px 4px' }}>
          <IonSegment value={mode} onIonChange={(e) => setMode(e.detail.value as Mode)}>
            <IonSegmentButton value="attendance">
              <IonLabel>{t('admin.imagesAttendance')}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="faceprint">
              <IonLabel>{t('admin.imagesFacePrint')}</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        {mode === 'attendance' && (
          <div className="tool-row">
            <IonItem lines="none">
              <IonInput
                type="date"
                label={t('admin.fromDate')}
                labelPlacement="stacked"
                value={from}
                onIonChange={(e) => setFrom(String(e.detail.value ?? ''))}
              />
            </IonItem>
            <IonItem lines="none">
              <IonInput
                type="date"
                label={t('admin.toDate')}
                labelPlacement="stacked"
                value={to}
                onIonChange={(e) => setTo(String(e.detail.value ?? ''))}
              />
            </IonItem>
          </div>
        )}

        {(canOp('delete') || canOp('export') || superadmin) && (
          <div className="tool-actions">
            {canOp('export') && tiles.length > 0 && (
              <IonButton size="small" fill="outline" onClick={() => void exportListed()}>
                <IonIcon slot="start" icon={archiveOutline} />
                {t('admin.exportListed', { count: tiles.length })}
              </IonButton>
            )}
            {canOp('delete') && tiles.length > 0 && (
              <IonButton
                size="small"
                color="danger"
                fill="outline"
                onClick={() =>
                  confirmDelete(
                    t('admin.deleteListedConfirm', { count: tiles.length }),
                    tiles.map((x) => x.path),
                  )
                }
              >
                <IonIcon slot="start" icon={trashOutline} />
                {t('admin.deleteListed', { count: tiles.length })}
              </IonButton>
            )}
            {/* Emptying the whole store is a superadmin decision, not a
                per-admin one — it wipes images for everyone at once. */}
            {superadmin && (
              <IonButton size="small" color="danger" onClick={() => void emptyAll()}>
                <IonIcon slot="start" icon={trashOutline} />
                {t('admin.emptyImages')}
              </IonButton>
            )}
          </div>
        )}

        {ids.length === 0 ? (
          <EmptyState icon={openOutline} title={t('admin.pickMemberFirst')} />
        ) : isFetching ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <IonSpinner name="crescent" />
          </div>
        ) : tiles.length === 0 ? (
          <EmptyState icon={openOutline} title={t('admin.noStoredImages')} />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 12,
              padding: 12,
            }}
          >
            {tiles.map((tile) => (
              <div key={tile.key} className="ui-surface" style={{ padding: 8, textAlign: 'center' }}>
                <img
                  src={tile.url}
                  alt=""
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10 }}
                />
                <div style={{ fontWeight: 600, marginTop: 6 }}>{tile.memberName}</div>
                <IonNote className="ui-caption ltr-nums">{tile.caption}</IonNote>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <IonButton
                    size="small"
                    fill="clear"
                    href={tile.url}
                    target="_blank"
                    rel="noreferrer"
                    title={t('admin.openImage')}
                  >
                    <IonIcon slot="icon-only" icon={openOutline} />
                  </IonButton>
                  {canOp('export') && (
                    <IonButton
                      size="small"
                      fill="clear"
                      title={t('admin.exportImage')}
                      onClick={() => void exportOne(tile)}
                    >
                      <IonIcon slot="icon-only" icon={downloadOutline} />
                    </IonButton>
                  )}
                  {canOp('delete') && (
                    <IonButton
                      size="small"
                      fill="clear"
                      color="danger"
                      title={t('admin.deleteImages')}
                      onClick={() =>
                        confirmDelete(
                          t('admin.deleteOneConfirm', { name: tile.memberName }),
                          [tile.path],
                        )
                      }
                    >
                      <IonIcon slot="icon-only" icon={trashOutline} />
                    </IonButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
