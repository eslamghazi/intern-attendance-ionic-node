import { useState } from 'react';
import {
  IonButton,
  IonCheckbox,
  IonChip,
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
  IonSelect,
  IonSelectOption,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import {
  add,
  businessOutline,
  calendarOutline,
  closeCircle,
  createOutline,
  keyOutline,
  personAddOutline,
  personCircle,
  trashOutline,
} from 'ionicons/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createStaff, resetStaffPassword } from '../../lib/api/admin';
import { parseEgyptianNationalId } from '../../lib/nationalId';
import {
  addAssignment,
  deleteAdmin,
  listAdmins,
  listAssignments,
  removeAssignment,
  updateAdmin,
  type AdminProfile,
} from '../../lib/api/admins';
import { listGroupOptions, listBranchOptions } from '../../lib/api/catalog';
import { qk } from '../../lib/api/keys';
import { NATIONAL_ID_LENGTH, TOAST_MS } from '../../lib/config';
import {
  GRANTABLE_PAGES,
  PAGE_OPS,
  effectivePermissions,
  type AdminPage,
  type GrantablePage,
  type Op,
} from '../../lib/permissions';
import AdminHeader from '../../components/AdminHeader';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import ListSkeleton from '../../components/ui/ListSkeleton';
import { useConfirm } from '../../components/ui/useConfirm';
import { useFeedback } from '../../components/ui/useFeedback';

interface AdminForm {
  national_id?: string;
  full_name?: string;
  phone?: string;
  role?: 'admin' | 'manager';
  pages?: AdminPage[];
  pageOps?: Partial<Record<AdminPage, Op[]>>;
}

/** Per-page ops for the edit form, derived from an admin's stored permissions
 *  (handles the legacy flat-ops shape via effectivePermissions). */
function initialPageOps(perm: AdminProfile['permissions']): Partial<Record<AdminPage, Op[]>> {
  const eff = effectivePermissions('admin', perm);
  const out: Partial<Record<AdminPage, Op[]>> = {};
  for (const p of GRANTABLE_PAGES) out[p] = PAGE_OPS[p].filter((o) => eff.opsFor(p).has(o));
  return out;
}

export default function AdminsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [present] = useIonToast();
  const [presentAlert] = useIonAlert();
  const confirm = useConfirm();
  const fb = useFeedback();

  // Show a staff member's default password (date of birth) + offer to reset it.
  const showStaffPassword = (a: AdminProfile) => {
    const dob = parseEgyptianNationalId(a.national_id).dobPassword ?? '—';
    presentAlert({
      header: t('admin.loginPassword'),
      message: `${a.full_name}\n\n${t('auth.nationalId')}: ${a.national_id}\n${t('admin.defaultPassword')}: ${dob}`,
      buttons: [
        {
          text: t('admin.resetPassword'),
          role: 'destructive',
          handler: () => void doResetStaff(a),
        },
        { text: t('common.ok'), role: 'cancel' },
      ],
    });
  };
  const doResetStaff = async (a: AdminProfile) => {
    const ok = await confirm({
      header: t('admin.resetPassword'),
      message: a.full_name,
      confirmText: t('admin.resetPassword'),
      danger: true,
    });
    if (!ok) return;
    const r = await fb.run(() => resetStaffPassword(a.id), { success: t('common.saved') });
    if (r) {
      presentAlert({
        header: t('common.saved'),
        message: t('admin.passwordResetTo', { nid: r.password }),
        buttons: [t('common.ok')],
      });
    }
  };

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AdminForm>({});
  const [editAdmin, setEditAdmin] = useState<AdminProfile | null>(null);
  const [editForm, setEditForm] = useState<AdminForm>({});
  const [assignAdmin, setAssignAdmin] = useState<string | null>(null);
  const [selBranches, setSelBranches] = useState<string[]>([]);
  const [selGroups, setSelGroups] = useState<string[]>([]);

  const { data: admins = [], isLoading, refetch } = useQuery({
    queryKey: qk.admins,
    queryFn: listAdmins,
  });
  const { data: assignments = [] } = useQuery({
    queryKey: qk.assignments,
    queryFn: listAssignments,
  });
  const { data: groups = [] } = useQuery({ queryKey: qk.groupOptions, queryFn: listGroupOptions });
  const { data: branches = [] } = useQuery({ queryKey: qk.branchOptions, queryFn: listBranchOptions });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.national_id || !form.full_name) throw new Error('missing');
      return createStaff({
        national_id: form.national_id,
        full_name: form.full_name,
        phone: form.phone,
        role: form.role ?? 'admin',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.admins });
      setOpen(false);
      setForm({});
      present({ message: t('admin.defaultPasswordNote'), duration: TOAST_MS.long, color: 'success' });
    },
    onError: () => present({ message: t('common.error'), duration: TOAST_MS.medium, color: 'danger' }),
  });

  const onSaveEdit = async () => {
    if (!editAdmin || !editForm.full_name || !editForm.national_id) return;
    const ok = await confirm({
      header: t('common.edit'),
      message: editForm.full_name,
      confirmText: t('common.save'),
    });
    if (!ok) return;
    const r = await fb.run(
      () =>
        updateAdmin({
          id: editAdmin.id,
          full_name: editForm.full_name!,
          national_id: editForm.national_id!,
          phone: editForm.phone,
          permissions:
            editAdmin.role === 'manager'
              ? null
              : (() => {
                  const pages = editForm.pages ?? [];
                  // Only keep per-page ops for pages the admin can actually open.
                  const pageOps: Partial<Record<AdminPage, Op[]>> = {};
                  for (const p of pages) pageOps[p] = editForm.pageOps?.[p] ?? [];
                  const ops = [...new Set(Object.values(pageOps).flat())]; // legacy union
                  return { pages, pageOps, ops };
                })(),
        }),
      { success: t('common.saved') },
    );
    if (r !== undefined) {
      setEditAdmin(null);
      qc.invalidateQueries({ queryKey: qk.admins });
    }
  };

  const onDelete = async (a: AdminProfile) => {
    const ok = await confirm({
      header: t('common.delete'),
      message: a.full_name,
      confirmText: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    const r = await fb.run(() => deleteAdmin(a.id), { success: t('common.saved') });
    if (r !== undefined) {
      qc.invalidateQueries({ queryKey: qk.admins });
      qc.invalidateQueries({ queryKey: qk.assignments });
    }
  };

  // Open the assignment modal pre-checked with the admin's current assignments.
  const openAssign = (adminId: string) => {
    const mine = assignments.filter((a) => a.admin_id === adminId);
    setSelBranches(mine.filter((a) => a.branch_id).map((a) => a.branch_id as string));
    setSelGroups(mine.filter((a) => a.group_id).map((a) => a.group_id as string));
    setAssignAdmin(adminId);
  };

  // Save = diff the checked branches/groups against the current assignments:
  // add the newly-checked, remove the unchecked.
  const saveAssignments = useMutation({
    mutationFn: async () => {
      if (!assignAdmin) return;
      const mine = assignments.filter((a) => a.admin_id === assignAdmin);
      const haveH = new Set(mine.filter((a) => a.branch_id).map((a) => a.branch_id));
      const haveB = new Set(mine.filter((a) => a.group_id).map((a) => a.group_id));
      const wantH = new Set(selBranches);
      const wantB = new Set(selGroups);
      // additions
      for (const id of selBranches) if (!haveH.has(id)) await addAssignment({ admin_id: assignAdmin, branch_id: id });
      for (const id of selGroups) if (!haveB.has(id)) await addAssignment({ admin_id: assignAdmin, group_id: id });
      // removals
      for (const a of mine) {
        if (a.branch_id && !wantH.has(a.branch_id)) await removeAssignment(a.id);
        if (a.group_id && !wantB.has(a.group_id)) await removeAssignment(a.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.assignments });
      setAssignAdmin(null);
      present({ message: t('common.saved'), duration: TOAST_MS.short, color: 'success' });
    },
    onError: () => present({ message: t('common.error'), duration: TOAST_MS.medium, color: 'danger' }),
  });

  const dropAssignment = useMutation({
    mutationFn: (id: string) => removeAssignment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.assignments }),
  });

  return (
    <IonPage>
      <AdminHeader title={t('nav.admins')} />
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => refetch().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        {isLoading ? (
          <ListSkeleton />
        ) : admins.length === 0 ? (
          <EmptyState icon={personCircle} title={t('common.none')} />
        ) : (
          <IonList>
            {admins.map((a) => {
              const mine = assignments.filter((x) => x.admin_id === a.id);
              const isManager = a.role === 'manager';
              return (
                <IonItem key={a.id}>
                  <div slot="start">
                    <Avatar name={a.full_name} />
                  </div>
                  <IonLabel className="ion-text-wrap">
                    <h3>
                      {a.full_name}
                      {isManager && (
                        <IonChip color="warning" style={{ marginInlineStart: 8 }}>
                          {t('roles.manager')}
                        </IonChip>
                      )}
                    </h3>
                    <IonNote className="ltr-nums">{a.national_id}</IonNote>
                    {!isManager && (
                      <div style={{ marginTop: 4 }}>
                        {mine.length === 0 && <IonNote>{t('common.all')}</IonNote>}
                        {mine.map((m) => (
                          <IonChip
                            key={m.id}
                            onClick={async () => {
                              if (
                                await confirm({
                                  header: t('common.delete'),
                                  message: m.branch?.name ?? m.group?.name,
                                  confirmText: t('common.delete'),
                                  danger: true,
                                })
                              ) {
                                dropAssignment.mutate(m.id);
                              }
                            }}
                          >
                            <IonIcon icon={m.branch ? businessOutline : calendarOutline} />
                            <IonLabel>{m.branch?.name ?? m.group?.name}</IonLabel>
                            <IonIcon icon={closeCircle} />
                          </IonChip>
                        ))}
                      </div>
                    )}
                  </IonLabel>
                  <IonButton fill="clear" onClick={() => showStaffPassword(a)} title={t('admin.loginPassword')}>
                    <IonIcon slot="icon-only" icon={keyOutline} />
                  </IonButton>
                  {!isManager && (
                    <IonButton fill="clear" onClick={() => openAssign(a.id)} title={t('admin.assignment')}>
                      <IonIcon slot="icon-only" icon={personAddOutline} />
                    </IonButton>
                  )}
                  <IonButton
                    fill="clear"
                    onClick={() => {
                      setEditForm({
                        full_name: a.full_name,
                        national_id: a.national_id,
                        phone: a.phone ?? '',
                        pages: a.permissions?.pages ?? [...GRANTABLE_PAGES],
                        pageOps: initialPageOps(a.permissions),
                      });
                      setEditAdmin(a);
                    }}
                  >
                    <IonIcon slot="icon-only" icon={createOutline} />
                  </IonButton>
                  <IonButton fill="clear" color="danger" onClick={() => onDelete(a)}>
                    <IonIcon slot="icon-only" icon={trashOutline} />
                  </IonButton>
                </IonItem>
              );
            })}
          </IonList>
        )}

        <IonFab slot="fixed" vertical="bottom" horizontal="end">
          <IonFabButton onClick={() => setOpen(true)}>
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        {/* Create admin */}
        <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
          <AdminHeader title={t('admin.addAdmin')}>
            <IonButton onClick={() => setOpen(false)}>{t('common.cancel')}</IonButton>
          </AdminHeader>
          <IonContent className="ion-padding">
            <IonList>
              <IonItem>
                <IonSelect
                  label={t('admin.role')}
                  labelPlacement="stacked"
                  value={form.role ?? 'admin'}
                  onIonChange={(e) => setForm({ ...form, role: e.detail.value })}
                >
                  <IonSelectOption value="admin">{t('roles.admin')}</IonSelectOption>
                  <IonSelectOption value="manager">{t('roles.manager')}</IonSelectOption>
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonInput fill="outline"
                  label={t('auth.nationalId')}
                  labelPlacement="stacked"
                  className="ltr-nums"
                  inputmode="numeric"
                  maxlength={NATIONAL_ID_LENGTH}
                  value={form.national_id ?? ''}
                  onIonInput={(e) => setForm({ ...form, national_id: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonInput fill="outline"
                  label={t('admin.fullName')}
                  labelPlacement="stacked"
                  value={form.full_name ?? ''}
                  onIonInput={(e) => setForm({ ...form, full_name: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonInput fill="outline"
                  label={t('admin.phone')}
                  labelPlacement="stacked"
                  value={form.phone ?? ''}
                  onIonInput={(e) => setForm({ ...form, phone: e.detail.value ?? '' })}
                />
              </IonItem>
            </IonList>
            <IonNote className="ion-padding ui-caption" style={{ display: 'block' }}>
              {t('admin.roleNote')}
            </IonNote>
            <IonButton expand="block" onClick={() => create.mutate()} disabled={create.isPending}>
              {t('common.save')}
            </IonButton>
          </IonContent>
        </IonModal>

        {/* Edit admin */}
        <IonModal isOpen={!!editAdmin} onDidDismiss={() => setEditAdmin(null)}>
          <AdminHeader title={t('common.edit')}>
            <IonButton onClick={() => setEditAdmin(null)}>{t('common.cancel')}</IonButton>
          </AdminHeader>
          <IonContent className="ion-padding">
            <IonList>
              <IonItem>
                <IonInput fill="outline"
                  label={t('auth.nationalId')}
                  labelPlacement="stacked"
                  className="ltr-nums"
                  inputmode="numeric"
                  maxlength={NATIONAL_ID_LENGTH}
                  value={editForm.national_id ?? ''}
                  onIonInput={(e) => setEditForm({ ...editForm, national_id: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonInput fill="outline"
                  label={t('admin.fullName')}
                  labelPlacement="stacked"
                  value={editForm.full_name ?? ''}
                  onIonInput={(e) => setEditForm({ ...editForm, full_name: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonInput fill="outline"
                  label={t('admin.phone')}
                  labelPlacement="stacked"
                  value={editForm.phone ?? ''}
                  onIonInput={(e) => setEditForm({ ...editForm, phone: e.detail.value ?? '' })}
                />
              </IonItem>
            </IonList>

            {editAdmin?.role !== 'manager' && (
              <>
                <IonNote className="ion-padding ui-caption" style={{ display: 'block' }}>
                  {t('perm.pagesHint')}
                </IonNote>
                <IonList>
                  {GRANTABLE_PAGES.map((p) => {
                    const on = editForm.pages?.includes(p) ?? false;
                    const opsForP = (editForm.pageOps?.[p] ?? []) as Op[];
                    const toggleOp = (o: Op, checked: boolean) =>
                      setEditForm((f) => {
                        const cur = f.pageOps?.[p] ?? [];
                        const next = checked ? [...cur, o] : cur.filter((x) => x !== o);
                        return { ...f, pageOps: { ...(f.pageOps ?? {}), [p]: next } };
                      });
                    return (
                      <div key={p} className="ui-surface" style={{ margin: '8px 12px', overflow: 'hidden' }}>
                        <IonItem lines={on ? 'full' : 'none'}>
                          <IonCheckbox
                            checked={on}
                            onIonChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                pages: e.detail.checked
                                  ? [...(f.pages ?? []), p]
                                  : (f.pages ?? []).filter((x) => x !== p),
                              }))
                            }
                          >
                            <strong>{t(`nav.${p}`)}</strong>
                          </IonCheckbox>
                        </IonItem>
                        {on && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 14px 10px' }}>
                            {PAGE_OPS[p as GrantablePage].map((o) => (
                              <IonChip
                                key={o}
                                color={opsForP.includes(o) ? 'primary' : 'medium'}
                                outline={!opsForP.includes(o)}
                                onClick={() => toggleOp(o, !opsForP.includes(o))}
                              >
                                <IonLabel>{t(`perm.${o}`)}</IonLabel>
                              </IonChip>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </IonList>
              </>
            )}

            <IonButton expand="block" onClick={onSaveEdit}>
              {t('common.save')}
            </IonButton>
          </IonContent>
        </IonModal>

        {/* Assignments — multi-select; currently-assigned ones are pre-checked */}
        <IonModal isOpen={!!assignAdmin} onDidDismiss={() => setAssignAdmin(null)}>
          <AdminHeader title={t('admin.assignment')}>
            <IonButton onClick={() => setAssignAdmin(null)}>{t('common.cancel')}</IonButton>
          </AdminHeader>
          <IonContent className="ion-padding">
            <IonNote className="ion-padding ui-caption" style={{ display: 'block' }}>
              {t('admin.assignmentHint')}
            </IonNote>
            <IonList>
              <IonItem>
                <IonSelect
                  multiple
                  label={t('admin.branch')}
                  placeholder={t('common.all')}
                  value={selBranches}
                  onIonChange={(e) => setSelBranches(e.detail.value)}
                >
                  {branches.map((h) => (
                    <IonSelectOption key={h.id} value={h.id}>
                      {h.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonSelect
                  multiple
                  label={t('admin.group')}
                  placeholder={t('common.all')}
                  value={selGroups}
                  onIonChange={(e) => setSelGroups(e.detail.value)}
                >
                  {groups.map((b) => (
                    <IonSelectOption key={b.id} value={b.id}>
                      {b.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            </IonList>
            <IonButton expand="block" onClick={() => saveAssignments.mutate()} disabled={saveAssignments.isPending}>
              {t('common.save')}
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
