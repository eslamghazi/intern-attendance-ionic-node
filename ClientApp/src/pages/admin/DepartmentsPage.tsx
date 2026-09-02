import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  useIonToast,
} from '@ionic/react';
import { addOutline, businessOutline, createOutline, trashOutline } from 'ionicons/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { deleteDepartment, listDepartments, saveDepartment } from '../../lib/api/departments';
import { listBranchOptions } from '../../lib/api/catalog';
import { qk } from '../../lib/api/keys';
import { TOAST_MS } from '../../lib/config';
import AdminHeader from '../../components/AdminHeader';
import CopyId from '../../components/ui/CopyId';
import SectionHeader from '../../components/ui/SectionHeader';
import EmptyState from '../../components/ui/EmptyState';
import { useConfirm } from '../../components/ui/useConfirm';

/** Simple department catalog: each department belongs to one branch. Adding and
 *  re-linking is all this page does — per-member monthly assignment happens
 *  through the roster upload. */
export default function DepartmentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [toast] = useIonToast();

  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [edit, setEdit] = useState<{ id: string; name: string; branch_id: string } | null>(null);

  const { data: departments = [] } = useQuery({ queryKey: qk.departments, queryFn: listDepartments });
  const { data: branches = [] } = useQuery({ queryKey: qk.branchOptions, queryFn: listBranchOptions });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.departments });
    qc.invalidateQueries({ queryKey: qk.departmentOptions });
  };

  const add = async () => {
    const nm = name.trim();
    if (!nm || !branchId) {
      toast({ message: t('departments.needBranch'), duration: TOAST_MS.medium, color: 'warning' });
      return;
    }
    try {
      await saveDepartment({ name: nm, branch_id: branchId });
      setName('');
      refresh();
      toast({ message: t('common.saved'), duration: TOAST_MS.brief, color: 'success' });
    } catch {
      toast({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
    }
  };

  const remove = async (id: string, nm: string) => {
    const ok = await confirm({ header: t('common.delete'), message: nm, confirmText: t('common.delete'), danger: true });
    if (!ok) return;
    try {
      await deleteDepartment(id);
      refresh();
    } catch {
      toast({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
    }
  };

  const saveEdit = async () => {
    if (!edit) return;
    const nm = edit.name.trim();
    if (!nm || !edit.branch_id) {
      toast({ message: t('departments.needBranch'), duration: TOAST_MS.medium, color: 'warning' });
      return;
    }
    try {
      await saveDepartment({ id: edit.id, name: nm, branch_id: edit.branch_id });
      setEdit(null);
      refresh();
      toast({ message: t('common.saved'), duration: TOAST_MS.brief, color: 'success' });
    } catch {
      toast({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
    }
  };

  // Group departments under their branch so the link is obvious at a glance.
  const groups = branches
    .map((b) => ({ id: b.id, name: b.name, items: departments.filter((d) => d.branch_id === b.id) }))
    .filter((g) => g.items.length);
  const orphans = departments.filter((d) => !d.branch_id || !branches.some((b) => b.id === d.branch_id));
  if (orphans.length) groups.push({ id: 'none', name: t('common.none'), items: orphans });

  return (
    <IonPage>
      <AdminHeader title={t('nav.departments')} />
      <IonContent>
        {/* Add a department and link it to its branch. */}
        <SectionHeader title={t('departments.add')} />
        <div className="ui-surface ui-section">
          <IonItem lines="none">
            <IonInput
              fill="outline"
              label={t('departments.name')}
              labelPlacement="stacked"
              value={name}
              onIonInput={(e) => setName(e.detail.value ?? '')}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </IonItem>
          <IonItem lines="none">
            <IonSelect
              label={t('departments.branch')}
              labelPlacement="stacked"
              placeholder={t('common.select')}
              value={branchId}
              onIonChange={(e) => setBranchId(String(e.detail.value))}
            >
              {branches.map((b) => (
                <IonSelectOption key={b.id} value={b.id}>
                  {b.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonButton expand="block" className="ion-margin-top" onClick={add} disabled={!name.trim() || !branchId}>
            <IonIcon slot="start" icon={addOutline} />
            {t('common.add')}
          </IonButton>
        </div>

        {/* Departments grouped by branch. */}
        <SectionHeader title={t('departments.catalog')} />
        {departments.length === 0 ? (
          <EmptyState icon={businessOutline} title={t('common.none')} />
        ) : (
          groups.map((g) => (
            <div key={g.id} className="ui-surface ui-section">
              <IonList>
                <IonListHeader>
                  <IonIcon icon={businessOutline} style={{ marginInlineEnd: 8 }} />
                  <IonLabel>{g.name}</IonLabel>
                  <IonNote slot="end">{g.items.length}</IonNote>
                </IonListHeader>
                {g.items.map((d) => (
                  <IonItem key={d.id}>
                    <IonLabel className="ion-text-wrap">
                      {d.name}
                      <div>
                        <CopyId id={d.id} />
                      </div>
                    </IonLabel>
                    <IonButton
                      slot="end"
                      fill="clear"
                      onClick={() => setEdit({ id: d.id, name: d.name, branch_id: d.branch_id ?? '' })}
                    >
                      <IonIcon slot="icon-only" icon={createOutline} />
                    </IonButton>
                    <IonButton slot="end" fill="clear" color="danger" onClick={() => remove(d.id, d.name)}>
                      <IonIcon slot="icon-only" icon={trashOutline} />
                    </IonButton>
                  </IonItem>
                ))}
              </IonList>
            </div>
          ))
        )}

        {/* Edit a department: rename and/or move it to another branch. */}
        <IonModal isOpen={!!edit} onDidDismiss={() => setEdit(null)}>
          <AdminHeader title={t('common.edit')}>
            <IonButton onClick={() => setEdit(null)}>{t('common.cancel')}</IonButton>
          </AdminHeader>
          <IonContent className="ion-padding">
            <IonItem lines="none">
              <IonInput
                fill="outline"
                label={t('departments.name')}
                labelPlacement="stacked"
                value={edit?.name ?? ''}
                onIonInput={(e) => setEdit((s) => (s ? { ...s, name: e.detail.value ?? '' } : s))}
              />
            </IonItem>
            <IonItem lines="none" className="ion-margin-top">
              <IonSelect
                label={t('departments.branch')}
                labelPlacement="stacked"
                placeholder={t('common.select')}
                value={edit?.branch_id ?? ''}
                onIonChange={(e) => setEdit((s) => (s ? { ...s, branch_id: String(e.detail.value) } : s))}
              >
                {branches.map((b) => (
                  <IonSelectOption key={b.id} value={b.id}>
                    {b.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonButton expand="block" className="ion-margin-top" onClick={saveEdit}>
              {t('common.save')}
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
