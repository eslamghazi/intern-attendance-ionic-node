import { useState } from 'react';
import {
  IonBadge,
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
} from '@ionic/react';
import { add, createOutline, timeOutline, trashOutline } from 'ionicons/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { deleteShift, listShifts, saveShift } from '../../lib/api/catalog';
import { qk } from '../../lib/api/keys';
import { formatClock } from '../../lib/date';
import type { Shift } from '../../lib/types';
import AdminHeader from '../../components/AdminHeader';
import EmptyState from '../../components/ui/EmptyState';
import ListSkeleton from '../../components/ui/ListSkeleton';
import { useConfirm } from '../../components/ui/useConfirm';
import { useFeedback } from '../../components/ui/useFeedback';

const EMPTY: Partial<Shift> = {
  name: '',
  key: '',
  checkin_open: '05:30',
  checkin_late: '06:00',
  checkin_close: '07:00',
  checkout_open: '14:00',
  checkout_close: '15:00',
};

export default function ShiftsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fb = useFeedback();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Shift>>(EMPTY);

  const { data: shifts = [], isLoading, refetch } = useQuery({
    queryKey: qk.shifts,
    queryFn: listShifts,
  });

  const save = useMutation({
    mutationFn: (s: Partial<Shift>) => saveShift(s),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shiftOptions }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteShift(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shiftOptions }),
  });

  const onSave = async () => {
    if (!draft.name || !draft.key) return;
    const ok = await confirm({
      header: draft.id ? t('common.edit') : t('common.add'),
      message: draft.name,
      confirmText: t('common.save'),
    });
    if (!ok) return;
    const r = await fb.run(() => save.mutateAsync(draft), { success: t('common.saved') });
    if (r !== undefined) setOpen(false);
  };
  const onDelete = async (s: Shift) => {
    const ok = await confirm({
      header: t('common.delete'),
      message: s.name,
      confirmText: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    await fb.run(() => remove.mutateAsync(s.id), { success: t('common.saved') });
  };

  return (
    <IonPage>
      <AdminHeader title={t('nav.shifts')} />
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => refetch().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        {isLoading ? (
          <ListSkeleton avatar={false} />
        ) : shifts.length === 0 ? (
          <EmptyState icon={timeOutline} title={t('common.none')} />
        ) : (
          <IonList>
            {shifts.map((s) => (
              <IonItem key={s.id}>
                {s.key && (
                  <IonBadge slot="start" color="primary">
                    {s.key}
                  </IonBadge>
                )}
                <IonLabel>
                  <h3>{s.name}</h3>
                  <IonNote className="ltr-nums" style={{ display: 'block' }}>
                    {t('shifts.checkin')}: {formatClock(s.checkin_open)} – {formatClock(s.checkin_close)} ·{' '}
                    {t('shifts.late')} {formatClock(s.checkin_late)}
                  </IonNote>
                  <IonNote className="ltr-nums" style={{ display: 'block' }}>
                    {t('shifts.checkout')}: {formatClock(s.checkout_open)} – {formatClock(s.checkout_close)}
                  </IonNote>
                </IonLabel>
                <IonButton
                  fill="clear"
                  onClick={() => {
                    setDraft(s);
                    setOpen(true);
                  }}
                >
                  <IonIcon slot="icon-only" icon={createOutline} />
                </IonButton>
                <IonButton fill="clear" color="danger" onClick={() => onDelete(s)}>
                  <IonIcon slot="icon-only" icon={trashOutline} />
                </IonButton>
              </IonItem>
            ))}
          </IonList>
        )}

        <IonFab slot="fixed" vertical="bottom" horizontal="end">
          <IonFabButton
            onClick={() => {
              setDraft(EMPTY);
              setOpen(true);
            }}
          >
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
          <AdminHeader title={draft.id ? t('common.edit') : t('shifts.add')}>
            <IonButton onClick={() => setOpen(false)}>{t('common.cancel')}</IonButton>
          </AdminHeader>
          <IonContent className="ion-padding">
            <IonList inset>
              <IonItem>
                <IonInput fill="outline"
                  label={t('shifts.name')}
                  labelPlacement="stacked"
                  placeholder="صباحي / مسائي / ليلي"
                  value={draft.name}
                  onIonInput={(e) => setDraft({ ...draft, name: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonInput fill="outline"
                  label={t('shifts.key')}
                  labelPlacement="stacked"
                  placeholder="M / N / L"
                  maxlength={8}
                  value={draft.key ?? ''}
                  onIonInput={(e) => setDraft({ ...draft, key: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonInput fill="outline"
                  label={t('shifts.checkinOpen')}
                  labelPlacement="stacked"
                  className="ui-field"
                  type="time"
                  value={draft.checkin_open ?? ''}
                  onIonInput={(e) => setDraft({ ...draft, checkin_open: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonInput fill="outline"
                  label={t('shifts.checkinLate')}
                  labelPlacement="stacked"
                  className="ui-field"
                  type="time"
                  value={draft.checkin_late ?? ''}
                  onIonInput={(e) => setDraft({ ...draft, checkin_late: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonInput fill="outline"
                  label={t('shifts.checkinClose')}
                  labelPlacement="stacked"
                  className="ui-field"
                  type="time"
                  value={draft.checkin_close ?? ''}
                  onIonInput={(e) => setDraft({ ...draft, checkin_close: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonInput fill="outline"
                  label={t('shifts.checkoutOpen')}
                  labelPlacement="stacked"
                  className="ui-field"
                  type="time"
                  value={draft.checkout_open ?? ''}
                  onIonInput={(e) => setDraft({ ...draft, checkout_open: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonInput fill="outline"
                  label={t('shifts.checkoutClose')}
                  labelPlacement="stacked"
                  className="ui-field"
                  type="time"
                  value={draft.checkout_close ?? ''}
                  onIonInput={(e) => setDraft({ ...draft, checkout_close: e.detail.value ?? '' })}
                />
              </IonItem>
            </IonList>
            <IonNote className="ion-padding" color="medium" style={{ display: 'block' }}>
              {t('shifts.overnightHint')}
            </IonNote>
            <IonButton expand="block" onClick={onSave} disabled={!draft.name || !draft.key}>
              {t('common.save')}
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
