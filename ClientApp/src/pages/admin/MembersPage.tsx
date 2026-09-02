import { useMemo, useRef, useState } from 'react';
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
  IonChip,
  IonSelect,
  IonSelectOption,
  IonToggle,
  useIonActionSheet,
  useIonAlert,
  useIonLoading,
  useIonToast,
} from '@ionic/react';
import {
  add,
  alertCircleOutline,
  cameraOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  cloudUploadOutline,
  createOutline,
  downloadOutline,
  keyOutline,
  optionsOutline,
  peopleOutline,
  scanOutline,
  timeOutline,
  trashOutline,
} from 'ionicons/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createMembers, listMemberNationalIds, type NewMember } from '../../lib/api/admin';
import { listGroupOptions, listBranchOptions } from '../../lib/api/catalog';
import {
  bulkSetMemberFlag,
  bulkSetMemberFrozen,
  bulkUpdateMembers,
  bulkDeleteMembers,
  memberFlagStats,
  deleteMember,
  listMembersPaged,
  resetFace,
  updateMember,
  type MemberFilters,
  type MemberFlag,
  type MemberRow,
  type SearchField,
} from '../../lib/api/members';
import { uploadAvatar } from '../../lib/api/profile';
import { useBranding } from '../../lib/branding';
import { qk } from '../../lib/api/keys';
import { NATIONAL_ID_LENGTH, REPORT_PAGE_SIZE, TOAST_MS } from '../../lib/config';
import { usePagination, PAGE_SIZE } from '../../lib/pagination';
import { usePermissions } from '../../lib/usePermissions';
import { downloadTemplate, parseSheet } from '../../lib/sheet';
import { EXAMPLE } from '../../lib/exampleData';
import AdminHeader from '../../components/AdminHeader';
import { useReportExport } from '../../components/admin/useReportExport';
import SearchBox from '../../components/admin/SearchBox';
import GenerateDummyMembers from '../../components/admin/GenerateDummyMembers';
import ImportModal from '../../components/admin/ImportModal';
import type { ImportRowPreview, ImportStrategy } from '../../lib/importModes';
import BypassToggles from '../../components/admin/BypassToggles';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import ListSkeleton from '../../components/ui/ListSkeleton';
import SectionHeader from '../../components/ui/SectionHeader';
import Pager from '../../components/ui/Pager';
import { useConfirm } from '../../components/ui/useConfirm';
import { useFeedback } from '../../components/ui/useFeedback';

/** Basic email format check; empty is allowed (email is optional). */
const emailOk = (e?: string | null) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

interface EditForm {
  full_name?: string;
  national_id?: string;
  phone?: string;
  email?: string;
  avatar_url?: string | null;
  group_id?: string;
  branch_id?: string;
  is_active?: boolean;
  bypass_face?: boolean;
  bypass_location?: boolean;
  bypass_checkout_window?: boolean;
  frozen_at?: string | null;
  can_generate_qr?: boolean;
  can_make_roster?: boolean;
  can_reset_face?: boolean;
}

/** ISO timestamp -> value for <input type="datetime-local"> (local time). */
function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
/** datetime-local value -> ISO timestamp (or null when empty). */
function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

export default function MembersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const exportReport = useReportExport();
  const { canOp } = usePermissions('members');
  const { memberPhotos } = useBranding();
  const [present] = useIonToast();
  const [showLoading, dismissLoading] = useIonLoading();
  const confirm = useConfirm();
  const fb = useFeedback();
  const avatarRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<NewMember>>({});
  const [editRow, setEditRow] = useState<MemberRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({});
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [field, setField] = useState<SearchField>('name');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<MemberFilters>({});
  const [presentActionSheet] = useIonActionSheet();
  const [presentAlert] = useIonAlert();
  const [bulkFrozenOpen, setBulkFrozenOpen] = useState(false);
  const [bulkFrozenAt, setBulkFrozenAt] = useState('');
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkGroup, setBulkGroup] = useState('');
  const [bulkBranch, setBulkBranch] = useState('');
  const [bulkActive, setBulkActive] = useState<'' | 'true' | 'false'>('');
  const { page, setPage, pagesFor } = usePagination([search, field, filters]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [...qk.members, page, search, field, filters],
    queryFn: () => listMembersPaged({ page, pageSize: PAGE_SIZE, search, field, filters }),
  });
  const members = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = pagesFor(total);

  // Aggregate: how many filtered members have each option on (for the signs).
  const { data: stats } = useQuery({
    queryKey: [...qk.members, 'stats', search, field, filters],
    queryFn: () => memberFlagStats({ search, field, filters }),
  });

  const toggleFilter = (key: keyof MemberFilters) =>
    setFilters((f) => ({ ...f, [key]: f[key] ? undefined : true }));
  // Tri-state cycle for yes/no/all filters (face enrolled, active).
  const cycleFilter = (key: 'has_face' | 'is_active') =>
    setFilters((f) => ({
      ...f,
      [key]: f[key] === undefined ? true : f[key] === true ? false : undefined,
    }));
  const triLabel = (base: string, v?: boolean) =>
    `${base} · ${v === undefined ? t('common.all') : v ? t('common.yes') : t('common.no')}`;
  const triColor = (v?: boolean) => (v === undefined ? 'medium' : v ? 'success' : 'danger');

  // ✓ = all filtered have it, ◐ = some, ○ = none.
  const sign = (n: number | undefined) => {
    const tot = stats?.total ?? 0;
    if (!tot || !n) return '○';
    return n >= tot ? '✓' : '◐';
  };
  const allOn = (n: number | undefined) => !!stats?.total && (n ?? 0) >= stats.total;
  const { data: groups = [] } = useQuery({
    queryKey: qk.groupOptions,
    queryFn: listGroupOptions,
  });
  const { data: branches = [] } = useQuery({
    queryKey: qk.branchOptions,
    queryFn: listBranchOptions,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: qk.members });

  const printList = async () => {
    await showLoading({ message: t('common.processing') });
    try {
      const all = await listMembersPaged({ page: 1, pageSize: REPORT_PAGE_SIZE, search, field, filters });
      await dismissLoading();
      // Export follows the current search + filters (the fetch above already
      // applied them); label the title with the search term when present.
      exportReport({
        title: `${t('nav.members')}${search ? ` — ${search}` : ''}`,
        filename: 'members',
        headers: [t('admin.memberCode'), t('auth.nationalId'), t('admin.fullName'), t('admin.email'), t('admin.group'), t('admin.branch'), t('attendance.status')],
        rows: [
          ...all.rows.map((r) => [
            r.member_code ?? '',
            r.profile?.national_id ?? '',
            r.profile?.full_name ?? '',
            r.profile?.email ?? '',
            r.group?.name ?? '',
            r.branch?.name ?? '',
            t(`admin.${r.is_active ? 'active' : 'inactive'}`),
          ]),
          // How many members this export covers — the same number the page shows.
          [t('rosters.total'), String(all.rows.length), '', '', '', '', ''],
        ],
      });
    } catch {
      await dismissLoading();
      present({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
    }
  };

  // Apply a "magic" flag to EVERY member matching the current search + filters.
  // (Single action sheet — the handler runs the mutation directly; no nested
  //  overlays, which is what previously made "apply to all" do nothing.)
  const runBulkFlag = async (flag: MemberFlag, value: boolean) => {
    const n = await fb.run(() => bulkSetMemberFlag({ search, field, filters, flag, value }), {
      success: t('common.saved'),
    });
    if (typeof n === 'number') {
      present({ message: t('admin.bulkApplied', { count: n }), duration: TOAST_MS.short, color: 'success' });
      refresh();
    }
  };

  // One entry per option that TOGGLES it for all filtered members: if every
  // filtered member already has it, the tap turns it off; otherwise on. The
  // label carries a sign (✓ all / ◐ some / ○ none).
  const openBulkMenu = () => {
    presentActionSheet({
      header: `${t('admin.applyToFiltered')} (${total})`,
      buttons: [
        {
          text: `${sign(stats?.bypass_face)}  ${t('admin.bypassFace')}`,
          handler: () => void runBulkFlag('bypass_face', !allOn(stats?.bypass_face)),
        },
        {
          text: `${sign(stats?.bypass_location)}  ${t('admin.bypassLocation')}`,
          handler: () => void runBulkFlag('bypass_location', !allOn(stats?.bypass_location)),
        },
        {
          text: `${sign(stats?.frozen)}  ${t('admin.frozenClock')} …`,
          handler: () => setBulkFrozenOpen(true),
        },
        {
          text: `${t('admin.bulkEdit')} …`,
          handler: () => {
            setBulkGroup('');
            setBulkBranch('');
            setBulkActive('');
            setBulkEditOpen(true);
          },
        },
        {
          text: `${t('admin.bulkDelete')} …`,
          role: 'destructive',
          handler: () => void bulkDelete(),
        },
        { text: t('common.cancel'), role: 'cancel' },
      ],
    });
  };

  // Permanently delete EVERY member matching the current filter — double-guarded.
  const bulkDelete = async () => {
    if (total === 0) return;
    const ok = await confirm({
      header: t('admin.bulkDelete'),
      message: t('admin.bulkDeleteConfirm', { count: total }),
      confirmText: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    const n = await fb.run(() => bulkDeleteMembers({ search, field, filters }), {
      success: t('common.saved'),
    });
    if (typeof n === 'number') {
      present({ message: t('admin.bulkDeleted', { count: n }), duration: TOAST_MS.long, color: 'success' });
      refresh();
    }
  };

  const applyBulkEdit = async () => {
    if (!bulkGroup && !bulkBranch && !bulkActive) return;
    const n = await fb.run(
      () =>
        bulkUpdateMembers({
          search,
          field,
          filters,
          patch: {
            ...(bulkGroup ? { group_id: bulkGroup } : {}),
            ...(bulkBranch ? { branch_id: bulkBranch } : {}),
            ...(bulkActive ? { is_active: bulkActive === 'true' } : {}),
          },
        }),
      { success: t('common.saved') },
    );
    if (typeof n === 'number') {
      setBulkEditOpen(false);
      present({ message: t('admin.bulkApplied', { count: n }), duration: TOAST_MS.short, color: 'success' });
      refresh();
    }
  };

  const applyBulkFrozen = async (clear: boolean) => {
    const n = await fb.run(
      () =>
        bulkSetMemberFrozen({
          search,
          field,
          filters,
          frozen_at: clear ? null : fromLocalInput(bulkFrozenAt),
        }),
      { success: t('common.saved') },
    );
    if (typeof n === 'number') {
      setBulkFrozenOpen(false);
      present({ message: t('admin.bulkApplied', { count: n }), duration: TOAST_MS.short, color: 'success' });
      refresh();
    }
  };

  // Members authenticate with their national ID as BOTH username and password —
  // there's no separate stored password (they have no auth user), so a "reset"
  // simply confirms the login password is the national ID (no server call).
  const showLoginPassword = (it: MemberRow) => {
    const nid = it.profile?.national_id ?? '';
    presentAlert({
      header: t('admin.loginPassword'),
      message: `${it.profile?.full_name ?? ''}\n\n${t('auth.nationalId')}: ${nid}\n${t('auth.password')}: ${nid}`,
      buttons: [
        {
          text: t('admin.resetPassword'),
          role: 'destructive',
          handler: () =>
            present({
              message: t('admin.passwordResetTo', { nid }),
              duration: TOAST_MS.long,
              color: 'success',
            }),
        },
        { text: t('common.ok'), role: 'cancel' },
      ],
    });
  };

  const openEdit = (it: MemberRow) => {
    setEditForm({
      full_name: it.profile?.full_name ?? '',
      national_id: it.profile?.national_id ?? '',
      phone: it.profile?.phone ?? '',
      email: it.profile?.email ?? '',
      avatar_url: it.avatar_url,
      group_id: it.group_id,
      branch_id: it.branch_id,
      is_active: it.is_active,
      bypass_face: it.bypass_face,
      bypass_location: it.bypass_location,
      bypass_checkout_window: it.bypass_checkout_window,
      frozen_at: it.frozen_at,
      can_generate_qr: it.can_generate_qr,
      can_make_roster: it.can_make_roster,
      can_reset_face: it.can_reset_face,
    });
    setAvatarBlob(null);
    setAvatarPreview(it.avatar_url ?? null);
    setEditRow(it);
  };

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setAvatarBlob(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const onSaveEdit = async () => {
    if (!editRow || !editForm.full_name || !editForm.national_id) return;
    if (!emailOk(editForm.email)) {
      present({ message: t('admin.invalidEmail'), duration: TOAST_MS.medium, color: 'danger' });
      return;
    }
    const ok = await confirm({
      header: t('common.edit'),
      message: editForm.full_name,
      confirmText: t('common.save'),
    });
    if (!ok) return;
    // updateMember resolves to void; map to `true` so a successful save is
    // distinguishable from the `undefined` fb.run returns on error.
    const r = await fb.run(
      async () => {
        let avatar_url = editForm.avatar_url ?? null;
        if (avatarBlob) avatar_url = await uploadAvatar(editRow.profile_id, avatarBlob);
        await updateMember({
          member_id: editRow.id,
          profile_id: editRow.profile_id,
          full_name: editForm.full_name!,
          national_id: editForm.national_id!,
          phone: editForm.phone,
          email: editForm.email,
          avatar_url,
          group_id: editForm.group_id,
          branch_id: editForm.branch_id,
          is_active: editForm.is_active,
          bypass_face: editForm.bypass_face,
          bypass_location: editForm.bypass_location,
          bypass_checkout_window: editForm.bypass_checkout_window,
          frozen_at: editForm.frozen_at ?? null,
          can_generate_qr: editForm.can_generate_qr,
          can_make_roster: editForm.can_make_roster,
          can_reset_face: editForm.can_reset_face,
        });
        return true;
      },
      { success: t('common.saved') },
    );
    if (r) {
      setEditRow(null);
      refresh();
    }
  };

  const onDeleteMember = async (it: MemberRow) => {
    const ok = await confirm({
      header: t('common.delete'),
      message: it.profile?.full_name,
      confirmText: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    await fb.run(() => deleteMember(it.profile_id), { success: t('common.saved') });
    refresh();
  };

  const onResetFace = async (it: MemberRow) => {
    const ok = await confirm({
      header: t('admin.resetFace'),
      message: `${it.profile?.full_name ?? ''}\n${t('admin.resetFaceNote')}`,
      confirmText: t('admin.resetFace'),
    });
    if (!ok) return;
    await fb.run(() => resetFace(it.id), { success: t('common.saved') });
    refresh();
  };

  const addOne = useMutation({
    mutationFn: async () => {
      if (!form.national_id || !form.full_name || !form.group_id || !form.branch_id) {
        throw new Error('missing');
      }
      if (!emailOk(form.email)) {
        present({ message: t('admin.invalidEmail'), duration: TOAST_MS.medium, color: 'danger' });
        throw new Error('bad_email');
      }
      return createMembers([form as NewMember]);
    },
    onSuccess: (res) => {
      refresh();
      setOpen(false);
      setForm({});
      const ok = res.results.filter((r) => r.ok).length;
      const err = res.results.find((r) => !r.ok);
      present({
        message: err ? `${err.national_id}: ${err.error}` : t('admin.imported', { count: ok }),
        duration: TOAST_MS.long,
        color: err ? 'danger' : 'success',
      });
    },
    onError: (e) => {
      if ((e as Error).message === 'bad_email') return; // specific toast already shown
      present({ message: t('common.error'), duration: TOAST_MS.medium, color: 'danger' });
    },
  });

  // Bulk-create members from CSV/XLSX via the options modal. Each row carries its
  // OWN group + branch (by name); the chosen conflict mode decides how national-ID
  // matches are handled (update / skip / fail).
  const [importOpen, setImportOpen] = useState(false);
  const membersImport = useMemo<ImportStrategy>(() => {
    const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
    return {
      titleKey: 'admin.importMembers',
      accept: '.xlsx,.xls,.csv',
      modes: ['update', 'skip', 'fail'],
      defaultMode: 'update',
      previewColumns: [
        t('import.colNationalId'),
        t('admin.fullName'),
        t('admin.group'),
        t('admin.branchName'),
      ],
      downloadTemplate: () =>
        downloadTemplate(
          'members-template.xlsx',
          // Both name AND id columns — fill either; id wins if both are present.
          ['national_id', 'full_name', 'phone', 'group', 'group_id', 'branch', 'branch_id'],
          {
            national_id: EXAMPLE.nationalId,
            full_name: EXAMPLE.fullName,
            phone: EXAMPLE.phone,
            group: groups[0]?.name ?? EXAMPLE.groupName,
            group_id: groups[0]?.id ?? '',
            branch: branches[0]?.name ?? EXAMPLE.branchName,
            branch_id: branches[0]?.id ?? '',
          },
        ),
      prepare: async (file) => {
        const data = await parseSheet(file);
        const groupByName = new Map(groups.map((b) => [norm(b.name), b.id]));
        const branchByName = new Map(branches.map((h) => [norm(h.name), h.id]));
        const groupIds = new Set(groups.map((b) => b.id));
        const branchIds = new Set(branches.map((h) => h.id));
        const existingIds = new Set(await listMemberNationalIds());

        let invalid = 0;
        const rows: NewMember[] = [];
        const preview: ImportRowPreview[] = [];
        for (const r of data) {
          const nid = String(r.national_id ?? '').trim();
          // Resolve group/branch by explicit id first, else by name.
          const gid = r.group_id && groupIds.has(r.group_id.trim()) ? r.group_id.trim() : groupByName.get(norm(r.group));
          const bid = r.branch_id && branchIds.has(r.branch_id.trim()) ? r.branch_id.trim() : branchByName.get(norm(r.branch));
          const cells = [nid, String(r.full_name ?? '').trim(), String(r.group_id || r.group || '').trim(), String(r.branch_id || r.branch || '').trim()];

          let error: string | undefined;
          if (!nid) error = t('import.errMissingNid');
          else if (!gid) error = t('import.errUnknownGroup');
          else if (!bid) error = t('import.errUnknownBranch');

          if (error) {
            invalid++;
            preview.push({ cells, status: 'invalid', error });
            continue;
          }
          rows.push({
            national_id: nid,
            full_name: String(r.full_name ?? '').trim(),
            phone: r.phone ? String(r.phone).trim() : null,
            email: r.email ? String(r.email).trim() : null,
            group_id: gid!,
            branch_id: bid!,
          });
          preview.push({ cells, status: existingIds.has(nid) ? 'update' : 'new' });
        }
        const isExisting = (row: unknown) => existingIds.has((row as NewMember).national_id);
        const existing = rows.filter(isExisting).length;
        const notes: string[] = [];
        if (invalid) notes.push(t('admin.importSkipped', { count: invalid }));
        return {
          rows,
          preview,
          existing,
          fresh: rows.length - existing,
          invalid,
          total: data.length,
          notes,
          isExisting,
        };
      },
      apply: async (prep, mode) => {
        const rows = prep.rows as NewMember[];
        if (mode === 'fail' && prep.existing > 0) {
          return { created: 0, updated: 0, skipped: 0, failed: prep.existing };
        }
        const toSend = mode === 'skip' ? rows.filter((r) => !prep.isExisting(r)) : rows;
        const res = await createMembers(toSend);
        return {
          created: res.created,
          updated: res.updated,
          skipped: mode === 'skip' ? prep.existing : 0,
          failed: 0,
        };
      },
    };
  }, [groups, branches, t]);

  return (
    <IonPage>
      <AdminHeader title={t('nav.members')}>
        {canOp('export') && (
          <IonButton onClick={printList} title={t('common.printReport')}>
            <IonIcon slot="icon-only" icon={downloadOutline} />
          </IonButton>
        )}
      </AdminHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => refetch().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        <ImportModal
          isOpen={importOpen}
          strategy={membersImport}
          onClose={() => setImportOpen(false)}
          onApplied={() => refresh()}
        />

        {/* Import members */}
        {canOp('create') && (
        <div className="ui-surface ui-section" style={{ overflow: 'hidden' }}>
          <SectionHeader title={t('admin.importMembers')} />
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px 8px', flexWrap: 'wrap' }}>
            <IonButton size="small" onClick={() => setImportOpen(true)}>
              <IonIcon slot="start" icon={cloudUploadOutline} />
              {t('admin.importMembers')}
            </IonButton>
            <GenerateDummyMembers />
          </div>
          <div className="ui-caption" style={{ padding: '0 14px 12px' }}>
            {t('admin.importHint')} · {t('admin.importUpsertHint')}
          </div>
        </div>
        )}

        <SectionHeader title={t('nav.members')} />
        <div className="ui-surface ui-section" style={{ overflow: 'hidden' }}>
          <SearchBox field={field} search={search} onField={setField} onSearch={setSearch} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 6,
              padding: '4px 12px 12px',
            }}
          >
            <IonChip
              color={filters.bypass_face ? 'primary' : 'medium'}
              outline={!filters.bypass_face}
              onClick={() => toggleFilter('bypass_face')}
            >
              {filters.bypass_face && <IonIcon icon={checkmarkCircleOutline} />}
              <IonLabel>{t('admin.bypassFace')}</IonLabel>
            </IonChip>
            <IonChip
              color={filters.bypass_location ? 'primary' : 'medium'}
              outline={!filters.bypass_location}
              onClick={() => toggleFilter('bypass_location')}
            >
              {filters.bypass_location && <IonIcon icon={checkmarkCircleOutline} />}
              <IonLabel>{t('admin.bypassLocation')}</IonLabel>
            </IonChip>
            <IonChip
              color={filters.frozen ? 'primary' : 'medium'}
              outline={!filters.frozen}
              onClick={() => toggleFilter('frozen')}
            >
              {filters.frozen ? <IonIcon icon={checkmarkCircleOutline} /> : <IonIcon icon={timeOutline} />}
              <IonLabel>{t('admin.frozenClock')}</IonLabel>
            </IonChip>
            <IonChip
              color={triColor(filters.has_face)}
              outline={filters.has_face === undefined}
              onClick={() => cycleFilter('has_face')}
            >
              <IonIcon icon={scanOutline} />
              <IonLabel>{triLabel(t('admin.filterFace'), filters.has_face)}</IonLabel>
            </IonChip>
            <IonChip
              color={triColor(filters.is_active)}
              outline={filters.is_active === undefined}
              onClick={() => cycleFilter('is_active')}
            >
              <IonIcon icon={checkmarkCircleOutline} />
              <IonLabel>{triLabel(t('admin.filterActive'), filters.is_active)}</IonLabel>
            </IonChip>
            {canOp('edit') && (
              <IonButton
                size="small"
                fill="solid"
                color="primary"
                style={{ marginInlineStart: 'auto' }}
                onClick={openBulkMenu}
              >
                <IonIcon slot="start" icon={optionsOutline} />
                {t('admin.applyToFiltered')}
              </IonButton>
            )}
          </div>
        </div>
        {/* How many members the current search + filters match in TOTAL — not
            just the ones on this page. */}
        {!isLoading && (
          <div className="grid-summary">
            <IonChip color="primary">
              <IonIcon icon={peopleOutline} />
              <IonLabel className="ltr-nums">
                {total} · {t('nav.members')}
              </IonLabel>
            </IonChip>
          </div>
        )}
        {isLoading ? (
          <ListSkeleton />
        ) : members.length === 0 ? (
          <EmptyState icon={peopleOutline} title={t('common.none')} />
        ) : (
          <IonList>
            {members.map((it) => (
              <IonItem key={it.id}>
                <div slot="start">
                  <Avatar name={it.profile?.full_name} src={it.avatar_url} />
                </div>
                <IonLabel>
                  <h3>
                    {it.profile?.full_name}
                    <IonIcon
                      icon={it.enrolled ? checkmarkCircle : alertCircleOutline}
                      color={it.enrolled ? 'success' : 'medium'}
                      title={t(it.enrolled ? 'admin.faceEnrolled' : 'admin.faceNotEnrolled')}
                      style={{ marginInlineStart: 6, verticalAlign: 'middle' }}
                    />
                    {it.frozen_at && (
                      <IonIcon
                        icon={timeOutline}
                        color="warning"
                        title={t('admin.frozenClock')}
                        style={{ marginInlineStart: 6, verticalAlign: 'middle' }}
                      />
                    )}
                  </h3>
                  {it.member_code && (
                    <IonNote
                      style={{
                        display: 'block',
                        textAlign: 'start',
                        fontWeight: 700,
                        color: 'var(--ion-color-primary)',
                      }}
                    >
                      <span className="ltr-nums">{it.member_code}</span>
                    </IonNote>
                  )}
                  <IonNote className="ltr-nums">{it.profile?.national_id}</IonNote>
                  <p>
                    {it.branch?.name} · {it.group?.name} ·{' '}
                    {t(`admin.${it.is_active ? 'active' : 'inactive'}`)}
                  </p>
                </IonLabel>
                {canOp('edit') && (
                  <IonButton
                    fill="clear"
                    onClick={() => showLoginPassword(it)}
                    title={t('admin.loginPassword')}
                  >
                    <IonIcon slot="icon-only" icon={keyOutline} />
                  </IonButton>
                )}
                {canOp('edit') &&
                  (it.enrolled ? (
                    // Has a face print → destructive delete, in red.
                    <IonButton
                      fill="clear"
                      color="danger"
                      onClick={() => onResetFace(it)}
                      title={t('admin.resetFace')}
                    >
                      <IonIcon slot="icon-only" icon={scanOutline} />
                    </IonButton>
                  ) : (
                    // No face print → nothing to delete; muted + disabled.
                    <IonButton fill="clear" color="medium" disabled title={t('admin.faceNotEnrolled')}>
                      <IonIcon slot="icon-only" icon={scanOutline} style={{ opacity: 0.4 }} />
                    </IonButton>
                  ))}
                {canOp('edit') && (
                  <IonButton fill="clear" onClick={() => openEdit(it)}>
                    <IonIcon slot="icon-only" icon={createOutline} />
                  </IonButton>
                )}
                {canOp('delete') && (
                  <IonButton fill="clear" color="danger" onClick={() => onDeleteMember(it)}>
                    <IonIcon slot="icon-only" icon={trashOutline} />
                  </IonButton>
                )}
              </IonItem>
            ))}
          </IonList>
        )}
        <Pager page={page} pages={pages} onPage={setPage} />

        {canOp('create') && (
          <IonFab slot="fixed" vertical="bottom" horizontal="end">
            <IonFabButton onClick={() => setOpen(true)}>
              <IonIcon icon={add} />
            </IonFabButton>
          </IonFab>
        )}

        <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
          <AdminHeader title={t('admin.addMember')}>
            <IonButton onClick={() => setOpen(false)}>{t('common.cancel')}</IonButton>
          </AdminHeader>
          <IonContent className="ion-padding">
            <IonList>
              <IonItem>
                <IonInput fill="outline"
                  label={t('auth.nationalId')}
                  labelPlacement="stacked"
                  inputmode="numeric"
                  maxlength={NATIONAL_ID_LENGTH}
                  className="ltr-nums"
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
              <IonItem>
                <IonInput fill="outline"
                  label={t('admin.email')}
                  labelPlacement="stacked"
                  type="email"
                  value={form.email ?? ''}
                  onIonInput={(e) => setForm({ ...form, email: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonSelect
                  label={t('admin.group')}
                  value={form.group_id}
                  onIonChange={(e) => setForm({ ...form, group_id: e.detail.value })}
                >
                  {groups.map((b) => (
                    <IonSelectOption key={b.id} value={b.id}>
                      {b.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonSelect
                  label={t('admin.branch')}
                  value={form.branch_id}
                  onIonChange={(e) => setForm({ ...form, branch_id: e.detail.value })}
                >
                  {branches.map((h) => (
                    <IonSelectOption key={h.id} value={h.id}>
                      {h.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            </IonList>
            <IonNote className="ion-padding" color="medium">
              {t('admin.memberLoginNote')}
            </IonNote>
            <IonButton expand="block" onClick={() => addOne.mutate()} disabled={addOne.isPending}>
              {t('common.save')}
            </IonButton>
          </IonContent>
        </IonModal>

        {/* Edit member */}
        <IonModal isOpen={!!editRow} onDidDismiss={() => setEditRow(null)}>
          <AdminHeader title={t('common.edit')}>
            <IonButton onClick={() => setEditRow(null)}>{t('common.cancel')}</IonButton>
          </AdminHeader>
          <IonContent className="ion-padding">
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={onPickAvatar} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Avatar name={editForm.full_name} src={avatarPreview} size={88} />
              {memberPhotos && (
                <IonButton fill="clear" size="small" onClick={() => avatarRef.current?.click()}>
                  <IonIcon slot="start" icon={cameraOutline} />
                  {t('profile.changePhoto')}
                </IonButton>
              )}
            </div>
            <IonList>
              <IonItem>
                <IonInput fill="outline"
                  label={t('auth.nationalId')}
                  labelPlacement="stacked"
                  inputmode="numeric"
                  maxlength={NATIONAL_ID_LENGTH}
                  className="ltr-nums"
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
              <IonItem>
                <IonInput fill="outline"
                  label={t('admin.email')}
                  labelPlacement="stacked"
                  type="email"
                  value={editForm.email ?? ''}
                  onIonInput={(e) => setEditForm({ ...editForm, email: e.detail.value ?? '' })}
                />
              </IonItem>
              <IonItem>
                <IonSelect
                  label={t('admin.group')}
                  value={editForm.group_id}
                  onIonChange={(e) => setEditForm({ ...editForm, group_id: e.detail.value })}
                >
                  {groups.map((b) => (
                    <IonSelectOption key={b.id} value={b.id}>
                      {b.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonSelect
                  label={t('admin.branch')}
                  value={editForm.branch_id}
                  onIonChange={(e) => setEditForm({ ...editForm, branch_id: e.detail.value })}
                >
                  {branches.map((h) => (
                    <IonSelectOption key={h.id} value={h.id}>
                      {h.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonLabel>{t('admin.active')}</IonLabel>
                <IonToggle
                  checked={editForm.is_active ?? true}
                  onIonChange={(e) => setEditForm({ ...editForm, is_active: e.detail.checked })}
                />
              </IonItem>
              <BypassToggles
                face={!!editForm.bypass_face}
                location={!!editForm.bypass_location}
                onFace={(v) => setEditForm({ ...editForm, bypass_face: v })}
                onLocation={(v) => setEditForm({ ...editForm, bypass_location: v })}
              />
              <IonItem>
                <IonLabel className="ion-text-wrap">{t('admin.bypassCheckoutWindow')}</IonLabel>
                <IonToggle
                  checked={!!editForm.bypass_checkout_window}
                  onIonChange={(e) => setEditForm({ ...editForm, bypass_checkout_window: e.detail.checked })}
                />
              </IonItem>
              <IonItem lines="none">
                <IonInput fill="outline"
                  className="ui-field"
                  type="datetime-local"
                  label={t('admin.frozenClock')}
                  labelPlacement="stacked"
                  value={toLocalInput(editForm.frozen_at)}
                  onIonInput={(e) =>
                    setEditForm({ ...editForm, frozen_at: fromLocalInput(e.detail.value ?? '') })
                  }
                />
                {editForm.frozen_at && (
                  <IonButton
                    slot="end"
                    fill="clear"
                    color="medium"
                    onClick={() => setEditForm({ ...editForm, frozen_at: null })}
                  >
                    {t('common.clear')}
                  </IonButton>
                )}
              </IonItem>
              <IonNote className="ion-padding-horizontal ui-caption" style={{ display: 'block' }}>
                {t('admin.frozenClockNote')}
              </IonNote>
              <IonItem>
                <IonLabel className="ion-text-wrap">{t('admin.canGenerateQr')}</IonLabel>
                <IonToggle
                  checked={!!editForm.can_generate_qr}
                  onIonChange={(e) => setEditForm({ ...editForm, can_generate_qr: e.detail.checked })}
                />
              </IonItem>
              <IonNote className="ion-padding-horizontal ui-caption" style={{ display: 'block' }}>
                {t('admin.canGenerateQrNote')}
              </IonNote>
              <IonItem>
                <IonLabel className="ion-text-wrap">{t('admin.canMakeRoster')}</IonLabel>
                <IonToggle
                  checked={!!editForm.can_make_roster}
                  onIonChange={(e) => setEditForm({ ...editForm, can_make_roster: e.detail.checked })}
                />
              </IonItem>
              <IonNote className="ion-padding-horizontal ui-caption" style={{ display: 'block' }}>
                {t('admin.canMakeRosterNote')}
              </IonNote>
              <IonItem>
                <IonLabel className="ion-text-wrap">{t('admin.canResetFace')}</IonLabel>
                <IonToggle
                  checked={!!editForm.can_reset_face}
                  onIonChange={(e) => setEditForm({ ...editForm, can_reset_face: e.detail.checked })}
                />
              </IonItem>
              <IonNote className="ion-padding-horizontal ui-caption" style={{ display: 'block' }}>
                {t('admin.canResetFaceNote')}
              </IonNote>
            </IonList>
            <IonButton expand="block" onClick={onSaveEdit}>
              {t('common.save')}
            </IonButton>
          </IonContent>
        </IonModal>

        {/* Bulk: freeze the clock for all filtered members */}
        <IonModal isOpen={bulkFrozenOpen} onDidDismiss={() => setBulkFrozenOpen(false)}>
          <AdminHeader title={`${t('admin.frozenClock')} (${total})`}>
            <IonButton onClick={() => setBulkFrozenOpen(false)}>{t('common.cancel')}</IonButton>
          </AdminHeader>
          <IonContent className="ion-padding">
            <IonNote className="ui-caption" style={{ display: 'block', marginBottom: 12 }}>
              {t('admin.frozenClockNote')}
            </IonNote>
            <IonItem>
              <IonInput fill="outline"
                className="ui-field"
                  type="datetime-local"
                label={t('admin.frozenClock')}
                labelPlacement="stacked"
                value={bulkFrozenAt}
                onIonInput={(e) => setBulkFrozenAt(e.detail.value ?? '')}
              />
            </IonItem>
            <IonButton
              expand="block"
              className="ion-margin-top"
              disabled={!bulkFrozenAt}
              onClick={() => applyBulkFrozen(false)}
            >
              {t('admin.applyToFiltered')}
            </IonButton>
            <IonButton expand="block" fill="outline" color="medium" onClick={() => applyBulkFrozen(true)}>
              {t('admin.clearFrozen')}
            </IonButton>
          </IonContent>
        </IonModal>

        {/* Bulk edit: change group / branch / status for all filtered members */}
        <IonModal isOpen={bulkEditOpen} onDidDismiss={() => setBulkEditOpen(false)}>
          <AdminHeader title={`${t('admin.bulkEdit')} (${total})`}>
            <IonButton onClick={() => setBulkEditOpen(false)}>{t('common.cancel')}</IonButton>
          </AdminHeader>
          <IonContent className="ion-padding">
            <IonNote className="ui-caption" style={{ display: 'block', marginBottom: 10 }}>
              {t('admin.bulkEditHint')}
            </IonNote>
            <IonList inset>
              <IonItem>
                <IonSelect
                  label={t('admin.group')}
                  labelPlacement="stacked"
                  placeholder={t('admin.noChange')}
                  value={bulkGroup}
                  onIonChange={(e) => setBulkGroup(String(e.detail.value))}
                >
                  <IonSelectOption value="">{t('admin.noChange')}</IonSelectOption>
                  {groups.map((g) => (
                    <IonSelectOption key={g.id} value={g.id}>
                      {g.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonSelect
                  label={t('admin.branch')}
                  labelPlacement="stacked"
                  placeholder={t('admin.noChange')}
                  value={bulkBranch}
                  onIonChange={(e) => setBulkBranch(String(e.detail.value))}
                >
                  <IonSelectOption value="">{t('admin.noChange')}</IonSelectOption>
                  {branches.map((b) => (
                    <IonSelectOption key={b.id} value={b.id}>
                      {b.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonSelect
                  label={t('attendance.status')}
                  labelPlacement="stacked"
                  placeholder={t('admin.noChange')}
                  value={bulkActive}
                  onIonChange={(e) => setBulkActive(e.detail.value as '' | 'true' | 'false')}
                >
                  <IonSelectOption value="">{t('admin.noChange')}</IonSelectOption>
                  <IonSelectOption value="true">{t('admin.active')}</IonSelectOption>
                  <IonSelectOption value="false">{t('admin.inactive')}</IonSelectOption>
                </IonSelect>
              </IonItem>
            </IonList>
            <IonButton
              expand="block"
              className="ion-margin-top"
              onClick={applyBulkEdit}
              disabled={!bulkGroup && !bulkBranch && !bulkActive}
            >
              {t('common.save')}
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
