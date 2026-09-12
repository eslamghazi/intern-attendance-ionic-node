import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonText,
  IonToggle,
} from '@ionic/react';
import { add, businessOutline, createOutline, trashOutline } from 'ionicons/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { deleteBranch, listBranches, listInstitutions, saveBranch } from '../../lib/api/catalog';
import { qk } from '../../lib/api/keys';
import type { Branch } from '../../lib/types';
import AdminHeader from '../../components/AdminHeader';
import CopyId from '../../components/ui/CopyId';
import MapPicker from '../../components/MapPicker';
import { LOCATION } from '../../lib/config';
import { usePermissions } from '../../lib/usePermissions';
import EmptyState from '../../components/ui/EmptyState';
import ListSkeleton from '../../components/ui/ListSkeleton';
import { useConfirm } from '../../components/ui/useConfirm';
import { useFeedback } from '../../components/ui/useFeedback';

const EMPTY: Partial<Branch> = { name: '', radius_meters: LOCATION.defaultRadiusMeters };

type LatLng = { lat: number; lng: number };
const centroid = (pts: LatLng[]): LatLng | null =>
  pts.length
    ? {
        lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
        lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
      }
    : null;

export default function BranchesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fb = useFeedback();
  const { canOp } = usePermissions('branches');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Branch>>(EMPTY);
  const [geoMode, setGeoMode] = useState<'circle' | 'polygon'>('circle');
  const [editKey, setEditKey] = useState(0); // remounts the map per editor session

  // Open the editor for a branch (or a blank one) and reflect its geofence type.
  const openEditor = (b: Partial<Branch>) => {
    setDraft(b);
    setGeoMode((b.area_coords?.length ?? 0) >= 3 ? 'polygon' : 'circle');
    setEditKey((k) => k + 1);
    setOpen(true);
  };
  const switchMode = (m: 'circle' | 'polygon') => {
    setGeoMode(m);
    if (m === 'circle') setDraft((d) => ({ ...d, area_coords: null }));
  };
  const geoReady =
    geoMode === 'polygon' ? (draft.area_coords?.length ?? 0) >= 3 : draft.latitude != null;

  const { data: institutions = [] } = useQuery({ queryKey: qk.institutions, queryFn: listInstitutions });
  const { data: branches = [], isLoading, refetch } = useQuery({
    queryKey: qk.branches,
    queryFn: listBranches,
  });

  const save = useMutation({
    mutationFn: (h: Partial<Branch>) => saveBranch(h),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.branchOptions }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.branchOptions }),
  });

  const onSave = async () => {
    if (!draft.name || !geoReady) return;
    const ok = await confirm({
      header: draft.id ? t('common.edit') : t('common.add'),
      message: draft.name,
      confirmText: t('common.save'),
    });
    if (!ok) return;
    const res = await fb.run(() => save.mutateAsync(draft), { success: t('common.saved') });
    if (res !== undefined) setOpen(false);
  };

  const onDelete = async (h: Branch) => {
    const ok = await confirm({
      header: t('common.delete'),
      message: h.name,
      confirmText: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    await fb.run(() => remove.mutateAsync(h.id), { success: t('common.saved') });
  };

  return (
    <IonPage>
      <AdminHeader title={t('nav.branches')} />
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => refetch().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        {isLoading ? (
          <ListSkeleton avatar={false} />
        ) : branches.length === 0 ? (
          <EmptyState icon={businessOutline} title={t('common.none')} />
        ) : (
          <IonList>
            {branches.map((h) => (
              <IonItem key={h.id}>
                <IonLabel>
                  <h3>{h.name}</h3>
                  <IonNote className="ltr-nums">
                    {h.latitude != null ? Number(h.latitude).toFixed(5) : '—'},{' '}
                    {h.longitude != null ? Number(h.longitude).toFixed(5) : '—'} ·{' '}
                    {h.area_coords?.length
                      ? `${t('admin.polygon')} (${h.area_coords.length})`
                      : `${h.radius_meters} m`}
                  </IonNote>
                  <div>
                    <CopyId id={h.id} />
                  </div>
                </IonLabel>
                {canOp('edit') && (
                  <IonButton fill="clear" onClick={() => openEditor(h)}>
                    <IonIcon slot="icon-only" icon={createOutline} />
                  </IonButton>
                )}
                {canOp('delete') && (
                  <IonButton fill="clear" color="danger" onClick={() => onDelete(h)}>
                    <IonIcon slot="icon-only" icon={trashOutline} />
                  </IonButton>
                )}
              </IonItem>
            ))}
          </IonList>
        )}

        {canOp('create') && (
          <IonFab slot="fixed" vertical="bottom" horizontal="end">
            <IonFabButton onClick={() => openEditor(EMPTY)}>
              <IonIcon icon={add} />
            </IonFabButton>
          </IonFab>
        )}

        <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
          <AdminHeader title={draft.id ? t('common.edit') : t('admin.branchName')} />
          <IonContent className="ion-padding">
            <IonList>
              <IonItem>
                <IonInput fill="outline"
                  label={t('admin.branchName')}
                  labelPlacement="stacked"
                  value={draft.name}
                  onIonInput={(e) => setDraft({ ...draft, name: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonInput fill="outline"
                  label={t('admin.address')}
                  labelPlacement="stacked"
                  value={draft.address ?? ''}
                  onIonInput={(e) => setDraft({ ...draft, address: e.detail.value ?? '' })}
                />
              </IonItem>
              {geoMode === 'circle' && (
                <IonItem>
                  <IonInput fill="outline"
                    label={t('admin.radius')}
                    labelPlacement="stacked"
                    type="number"
                    value={draft.radius_meters}
                    onIonInput={(e) => setDraft({ ...draft, radius_meters: Number(e.detail.value) })}
                  />
                </IonItem>
              )}
              <IonItem>
                <IonSelect
                  label={t('admin.institutionName')}
                  labelPlacement="stacked"
                  placeholder={t('common.none')}
                  value={draft.institution_id ?? ''}
                  onIonChange={(e) => setDraft({ ...draft, institution_id: e.detail.value || null })}
                >
                  <IonSelectOption value="">{t('common.none')}</IonSelectOption>
                  {institutions.map((i) => (
                    <IonSelectOption key={i.id} value={i.id}>
                      {i.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            </IonList>

            {/* Per-branch check-in controls. One clear choice of allowed method,
                plus independent "skip this check" bypasses. */}
            <IonList>
              <IonItem>
                <IonSelect
                  label={t('admin.checkinMethod')}
                  labelPlacement="stacked"
                  interface="popover"
                  value={
                    draft.block_checkin
                      ? 'none'
                      : draft.require_qr
                        ? 'qr'
                        : draft.qr_enabled === false
                          ? 'location'
                          : 'both'
                  }
                  onIonChange={(e) => {
                    const m = e.detail.value as 'both' | 'location' | 'qr' | 'none';
                    setDraft({
                      ...draft,
                      block_checkin: m === 'none',
                      require_qr: m === 'qr',
                      qr_enabled: m === 'qr' || m === 'both',
                    });
                  }}
                >
                  <IonSelectOption value="both">{t('admin.checkinMethodBoth')}</IonSelectOption>
                  <IonSelectOption value="location">{t('admin.checkinMethodLocation')}</IonSelectOption>
                  <IonSelectOption value="qr">{t('admin.checkinMethodQr')}</IonSelectOption>
                  <IonSelectOption value="none">{t('admin.checkinMethodNone')}</IonSelectOption>
                </IonSelect>
              </IonItem>
              <div className="ui-caption" style={{ padding: '2px 16px 8px' }}>
                {t('admin.checkinMethodNote')}
              </div>
              <IonItem>
                <IonToggle
                  checked={!!draft.bypass_location}
                  onIonChange={(e) => setDraft({ ...draft, bypass_location: e.detail.checked })}
                >
                  <IonLabel className="ion-text-wrap">
                    {t('admin.branchBypassLocation')}
                    <p className="ui-caption">{t('admin.branchBypassLocationNote')}</p>
                  </IonLabel>
                </IonToggle>
              </IonItem>
              <IonItem>
                <IonToggle
                  checked={!!draft.bypass_face}
                  onIonChange={(e) => setDraft({ ...draft, bypass_face: e.detail.checked })}
                >
                  <IonLabel className="ion-text-wrap">
                    {t('admin.branchBypassFace')}
                    <p className="ui-caption">{t('admin.branchBypassFaceNote')}</p>
                  </IonLabel>
                </IonToggle>
              </IonItem>
              <IonItem>
                <IonToggle
                  checked={!!draft.bypass_checkout_window}
                  onIonChange={(e) => setDraft({ ...draft, bypass_checkout_window: e.detail.checked })}
                >
                  <IonLabel className="ion-text-wrap">
                    {t('admin.bypassCheckoutWindow')}
                    <p className="ui-caption">{t('admin.branchBypassCheckoutNote')}</p>
                  </IonLabel>
                </IonToggle>
              </IonItem>
            </IonList>

            {/* Geofence type: a radius circle or a drawn polygon. */}
            <IonSegment
              value={geoMode}
              onIonChange={(e) => switchMode((e.detail.value as 'circle' | 'polygon') ?? 'circle')}
            >
              <IonSegmentButton value="circle">
                <IonLabel>{t('admin.circle')}</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="polygon">
                <IonLabel>{t('admin.polygon')}</IonLabel>
              </IonSegmentButton>
            </IonSegment>

            <IonText color="medium">
              <p>{geoMode === 'polygon' ? t('admin.polygonHint') : t('admin.pickOnMap')}</p>
            </IonText>
            <MapPicker
              key={editKey}
              lat={draft.latitude ?? null}
              lng={draft.longitude ?? null}
              radius={Number(draft.radius_meters) || LOCATION.defaultRadiusMeters}
              onChange={(lat, lng) => setDraft((d) => ({ ...d, latitude: lat, longitude: lng }))}
              mode={geoMode}
              polygon={draft.area_coords ?? []}
              onPolygonChange={(coords) => {
                const c = centroid(coords);
                setDraft((d) => ({
                  ...d,
                  area_coords: coords,
                  ...(c ? { latitude: c.lat, longitude: c.lng } : {}),
                }));
              }}
            />
            {geoMode === 'polygon' ? (
              <IonNote>{t('admin.polygonPoints', { count: draft.area_coords?.length ?? 0 })}</IonNote>
            ) : (
              draft.latitude != null && (
                <IonNote className="ltr-nums">
                  {draft.latitude.toFixed(6)}, {draft.longitude!.toFixed(6)}
                </IonNote>
              )
            )}

            <IonButton
              expand="block"
              className="ion-margin-top"
              onClick={onSave}
              disabled={!draft.name || !geoReady || save.isPending}
            >
              {t('common.save')}
            </IonButton>
            <IonButton expand="block" fill="clear" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
