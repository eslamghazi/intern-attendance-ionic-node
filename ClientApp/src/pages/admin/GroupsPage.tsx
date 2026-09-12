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
  IonToggle,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { add, businessOutline, calendarOutline, createOutline, trashOutline } from 'ionicons/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  deleteGroup,
  deleteInstitution,
  listGroups,
  listBranchOptions,
  listInstitutions,
  saveGroup,
  saveInstitution,
} from '../../lib/api/catalog';
import { qk } from '../../lib/api/keys';
import type { Group, Institution } from '../../lib/types';
import AdminHeader from '../../components/AdminHeader';
import CopyId from '../../components/ui/CopyId';
import EmptyState from '../../components/ui/EmptyState';
import ListSkeleton from '../../components/ui/ListSkeleton';
import DateField from '../../components/ui/DateField';
import { usePermissions } from '../../lib/usePermissions';
import { useConfirm } from '../../components/ui/useConfirm';
import { useFeedback } from '../../components/ui/useFeedback';
import { appToday } from '../../lib/clock';

// Built lazily (not at module load) so the default year comes from the single
// app clock once it's synced, not the device clock at import time.
const emptyGroup = (): Partial<Group> => ({ name: '', year: Number(appToday().slice(0, 4)) });

export default function GroupsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fb = useFeedback();
  const { canOp, superadmin } = usePermissions('groups');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Group>>(emptyGroup);
  const [instOpen, setInstOpen] = useState(false);
  const [instDraft, setInstDraft] = useState<Partial<Institution>>({ name: '', code: 1 });

  const { data: groups = [], isLoading, refetch } = useQuery({
    queryKey: qk.groups,
    queryFn: listGroups,
  });
  const { data: branches = [] } = useQuery({ queryKey: qk.branchOptions, queryFn: listBranchOptions });
  const { data: institutions = [] } = useQuery({
    queryKey: qk.institutions,
    queryFn: listInstitutions,
  });

  const save = useMutation({
    mutationFn: (b: Partial<Group>) => saveGroup(b),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.groupOptions }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.groupOptions }),
  });

  const refetchInstitutions = () => qc.invalidateQueries({ queryKey: qk.institutions });
  const saveInst = async () => {
    if (!instDraft.name) return;
    const r = await fb.run(() => saveInstitution(instDraft), { success: t('common.saved') });
    if (r !== undefined) {
      setInstDraft({ name: '', code: 1 });
      refetchInstitutions();
    }
  };
  const removeInst = async (i: Institution) => {
    const ok = await confirm({
      header: t('common.delete'),
      message: i.name,
      confirmText: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    await fb.run(() => deleteInstitution(i.id), { success: t('common.saved') });
    refetchInstitutions();
  };

  const edit = (b: Group) => {
    setDraft(b);
    setOpen(true);
  };
  const create = () => {
    setDraft(emptyGroup());
    setOpen(true);
  };

  const onSave = async () => {
    if (!draft.name) return;
    const ok = await confirm({
      header: draft.id ? t('common.edit') : t('common.add'),
      message: draft.name,
      confirmText: t('common.save'),
    });
    if (!ok) return;
    const res = await fb.run(() => save.mutateAsync(draft), { success: t('common.saved') });
    if (res !== undefined) setOpen(false);
  };

  const onDelete = async (b: Group) => {
    const ok = await confirm({
      header: t('common.delete'),
      message: b.name,
      confirmText: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    await fb.run(() => remove.mutateAsync(b.id), { success: t('common.saved') });
  };

  return (
    <IonPage>
      <AdminHeader title={t('nav.groups')}>
        {superadmin && (
          <IonButton onClick={() => setInstOpen(true)} title={t('admin.institutions')}>
            <IonIcon slot="icon-only" icon={businessOutline} />
          </IonButton>
        )}
      </AdminHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => refetch().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        {isLoading ? (
          <ListSkeleton avatar={false} />
        ) : groups.length === 0 ? (
          <EmptyState icon={calendarOutline} title={t('common.none')} />
        ) : (
          <IonList>
            {groups.map((b) => (
              <IonItem key={b.id}>
                <IonLabel>
                  <h3>{b.name}</h3>
                  <IonNote className="ltr-nums">
                    {b.year}
                    {(() => {
                      const inst = institutions.find((x) => x.id === b.institution_id);
                      return inst ? ` · ${inst.name} (${inst.code})` : '';
                    })()}
                  </IonNote>
                  <div>
                    <CopyId id={b.id} />
                  </div>
                </IonLabel>
                {canOp('edit') && (
                  <IonButton fill="clear" onClick={() => edit(b)}>
                    <IonIcon slot="icon-only" icon={createOutline} />
                  </IonButton>
                )}
                {canOp('delete') && (
                  <IonButton fill="clear" color="danger" onClick={() => onDelete(b)}>
                    <IonIcon slot="icon-only" icon={trashOutline} />
                  </IonButton>
                )}
              </IonItem>
            ))}
          </IonList>
        )}

        {canOp('create') && (
          <IonFab slot="fixed" vertical="bottom" horizontal="end">
            <IonFabButton onClick={create}>
              <IonIcon icon={add} />
            </IonFabButton>
          </IonFab>
        )}

        <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
          <AdminHeader title={draft.id ? t('common.edit') : t('admin.groupName')} />
          <IonContent className="ion-padding">
            <IonList>
              <IonItem>
                <IonInput fill="outline"
                  label={t('admin.groupName')}
                  labelPlacement="stacked"
                  value={draft.name}
                  onIonInput={(e) => setDraft({ ...draft, name: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonInput fill="outline"
                  label={t('admin.year')}
                  labelPlacement="stacked"
                  type="number"
                  value={draft.year}
                  onIonInput={(e) => setDraft({ ...draft, year: Number(e.detail.value) })}
                />
              </IonItem>
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
                      {i.name} ({i.code})
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonNote className="ion-padding ui-caption" style={{ display: 'block' }}>
                {t('admin.institutionCodeNote')}
              </IonNote>
              <IonItem>
                <IonSelect
                  label={t('departments.branch')}
                  labelPlacement="stacked"
                  placeholder={t('common.none')}
                  value={draft.branch_id ?? ''}
                  onIonChange={(e) => setDraft({ ...draft, branch_id: e.detail.value || null })}
                >
                  <IonSelectOption value="">{t('common.none')}</IonSelectOption>
                  {branches.map((h) => (
                    <IonSelectOption key={h.id} value={h.id}>
                      {h.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <DateField
                label={t('admin.startDate')}
                value={draft.start_date ?? ''}
                onChange={(v) => setDraft({ ...draft, start_date: v })}
              />
              <DateField
                label={t('admin.endDate')}
                value={draft.end_date ?? ''}
                onChange={(v) => setDraft({ ...draft, end_date: v })}
              />
              <IonItem>
                <IonLabel className="ion-text-wrap">{t('admin.bypassCheckoutWindow')}</IonLabel>
                <IonToggle
                  checked={!!draft.bypass_checkout_window}
                  onIonChange={(e) => setDraft({ ...draft, bypass_checkout_window: e.detail.checked })}
                />
              </IonItem>
            </IonList>
            <IonButton expand="block" onClick={onSave} disabled={!draft.name || save.isPending}>
              {t('common.save')}
            </IonButton>
            <IonButton expand="block" fill="clear" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </IonButton>
          </IonContent>
        </IonModal>

        {/* Institutions — managed once in one place, reused by every group */}
        <IonModal isOpen={instOpen} onDidDismiss={() => setInstOpen(false)}>
          <AdminHeader title={t('admin.institutions')}>
            <IonButton onClick={() => setInstOpen(false)}>{t('common.close')}</IonButton>
          </AdminHeader>
          <IonContent className="ion-padding">
            <div className="ui-surface ui-section" style={{ overflow: 'hidden' }}>
              <IonItem>
                <IonInput fill="outline"
                  label={t('admin.institutionName')}
                  labelPlacement="stacked"
                  placeholder={t('admin.institutionNamePlaceholder')}
                  value={instDraft.name ?? ''}
                  onIonInput={(e) => setInstDraft({ ...instDraft, name: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonInput fill="outline"
                  label={t('admin.institutionCode')}
                  labelPlacement="stacked"
                  type="number"
                  inputmode="numeric"
                  value={instDraft.code ?? 1}
                  onIonInput={(e) => setInstDraft({ ...instDraft, code: Number(e.detail.value) })}
                />
              </IonItem>
              <div style={{ padding: '8px 12px' }}>
                <IonButton size="small" onClick={saveInst} disabled={!instDraft.name}>
                  <IonIcon slot="start" icon={add} />
                  {instDraft.id ? t('common.save') : t('common.add')}
                </IonButton>
                {instDraft.id && (
                  <IonButton size="small" fill="clear" onClick={() => setInstDraft({ name: '', code: 1 })}>
                    {t('common.cancel')}
                  </IonButton>
                )}
              </div>
            </div>

            {institutions.length === 0 ? (
              <EmptyState icon={businessOutline} title={t('common.none')} />
            ) : (
              <IonList>
                {institutions.map((i) => (
                  <IonItem key={i.id}>
                    <IonLabel>
                      <h3>{i.name}</h3>
                      <IonNote className="ltr-nums">{i.code}</IonNote>
                    </IonLabel>
                    <IonButton fill="clear" onClick={() => setInstDraft(i)}>
                      <IonIcon slot="icon-only" icon={createOutline} />
                    </IonButton>
                    <IonButton fill="clear" color="danger" onClick={() => removeInst(i)}>
                      <IonIcon slot="icon-only" icon={trashOutline} />
                    </IonButton>
                  </IonItem>
                ))}
              </IonList>
            )}
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
