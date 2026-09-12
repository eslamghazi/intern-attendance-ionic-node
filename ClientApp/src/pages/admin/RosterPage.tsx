import { useEffect, useMemo, useState } from 'react';
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonContent,
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
  IonSkeletonText,
  useIonActionSheet,
  useIonAlert,
  useIonLoading,
  useIonToast,
} from '@ionic/react';
import { cloudUploadOutline, downloadOutline, duplicateOutline, informationCircleOutline } from 'ionicons/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useServerExport } from '../../components/useServerExport';
import { listBranchOptions, listShifts } from '../../lib/api/catalog';
import {
  addRosterShift,
  bulkApplyRosterShift,
  listMembers,
  listRosterDayKeys,
  listRosterDayTotals,
  listRosterForBranchMonth,
  removeRosterShift,
  upsertRosterDays,
  type BulkRosterMode,
  type RosterCell,
  type SearchField,
} from '../../lib/api/members';
import { getDayAttendance } from '../../lib/api/attendance';
import { listDepartmentOptions, listMemberDepartments, setMemberDepartment } from '../../lib/api/departments';
import { qk } from '../../lib/api/keys';
import { PAGE_SIZE, TOAST_MS } from '../../lib/config';
import { fetchAllPages } from '../../lib/pagination';
import { usePermissions } from '../../lib/usePermissions';
import { useServerToday } from '../../lib/useServerToday';
import { appToday } from '../../lib/clock';
import { parseSheet } from '../../lib/sheet';
import { downloadRosterTemplate } from '../../lib/rosterTemplate';
import AdminHeader from '../../components/AdminHeader';
import GridFilters from '../../components/admin/GridFilters';
import GridSummary from '../../components/admin/GridSummary';
import EmptyState from '../../components/ui/EmptyState';
import SectionHeader from '../../components/ui/SectionHeader';
import Pager from '../../components/ui/Pager';
import ImportModal from '../../components/admin/ImportModal';
import DetailsModal, { type DetailRow } from '../../components/admin/DetailsModal';
import type { ImportRowPreview, ImportStrategy } from '../../lib/importModes';
import { calendarNumberOutline } from 'ionicons/icons';

const pad = (n: number) => String(n).padStart(2, '0');

export default function RosterPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const serverExport = useServerExport();
  const { canOp } = usePermissions('rosters');
  const [present] = useIonToast();
  const [presentSheet] = useIonActionSheet();
  const [presentAlert] = useIonAlert();
  const [showLoading, dismissLoading] = useIonLoading();
  const [importOpen, setImportOpen] = useState(false);
  const [details, setDetails] = useState<{ title: string; rows: DetailRow[] } | null>(null);

  // Default to the current Cairo month/year from the single app clock.
  const nowDate = appToday(); // yyyy-mm-dd
  const [month, setMonth] = useState(Number(nowDate.slice(5, 7)));
  const [year, setYear] = useState(Number(nowDate.slice(0, 4)));
  const [branchId, setBranchId] = useState('');
  const [field, setField] = useState<SearchField>('name');
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [uploadDeptId, setUploadDeptId] = useState('');
  // The roster-upload flow carries its OWN branch + month/year, independent of
  // the page's top filters.
  const [uploadBranch, setUploadBranch] = useState('');
  const [uploadYear, setUploadYear] = useState(Number(nowDate.slice(0, 4)));
  const [uploadMonth, setUploadMonth] = useState(Number(nowDate.slice(5, 7)));
  const [page, setPage] = useState(1);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkShift, setBulkShift] = useState('');
  const [bulkFrom, setBulkFrom] = useState(1);
  const [bulkTo, setBulkTo] = useState(1);
  const [bulkDept, setBulkDept] = useState('');
  // The bulk modal carries its OWN filters, independent of the page's top ones.
  const [bulkBranch, setBulkBranch] = useState('');
  const [bulkSearch, setBulkSearch] = useState('');

  // Full member list (for mapping national_id -> id on upload).
  const { refetch } = useQuery({ queryKey: qk.members, queryFn: listMembers });
  const { data: shifts = [] } = useQuery({ queryKey: qk.shifts, queryFn: listShifts });
  const { data: branches = [] } = useQuery({ queryKey: qk.branchOptions, queryFn: listBranchOptions });
  const { data: departments = [] } = useQuery({
    queryKey: [...qk.departmentOptions, branchId],
    queryFn: () => listDepartmentOptions(branchId),
  });
  // Departments for the bulk modal's OWN branch (independent of the top filter).
  const { data: bulkDepartments = [] } = useQuery({
    queryKey: [...qk.departmentOptions, 'bulk', bulkBranch],
    queryFn: () => listDepartmentOptions(bulkBranch),
    enabled: !!bulkBranch,
  });
  // Departments for the roster-upload's OWN branch.
  const { data: uploadDepartments = [] } = useQuery({
    queryKey: [...qk.departmentOptions, 'upload', uploadBranch],
    queryFn: () => listDepartmentOptions(uploadBranch),
    enabled: !!uploadBranch,
  });
  const { data: memberDeptMap = {} } = useQuery({
    queryKey: qk.memberDepartments(year, month),
    queryFn: () => listMemberDepartments(year, month),
  });
  const deptNameOf = (memberId: string) =>
    departments.find((d) => d.id === memberDeptMap[memberId])?.name ?? '';

  // isLoading (not isFetching): the skeleton shows only on the FIRST load — a
  // shift add/edit/remove refetches in the background and keeps the grid on
  // screen instead of blanking back to a loading state.
  const { data, isLoading: rosterLoading } = useQuery({
    queryKey: qk.rosterView(branchId, year, month, page, search, field, departmentId),
    queryFn: () => listRosterForBranchMonth({ branchId, year, month, page, pageSize: PAGE_SIZE, search, field, departmentId }),
  });
  const rosterRows = data?.rows ?? [];
  const total = data?.total ?? 0;

  // Day totals across EVERY member the filters match (the grid only shows one
  // page), counted server-side.
  const { data: totals } = useQuery({
    queryKey: qk.rosterTotals(branchId, year, month, search, field, departmentId),
    queryFn: () => listRosterDayTotals({ branchId, year, month, search, field, departmentId }),
  });
  const shiftName = (id: string) => shifts.find((sh) => sh.id === id)?.name ?? '';
  /** "صباحي: 12 · مسائي: 4" — the per-shift split behind a day's total. */
  const dayBreakdown = (day: number) =>
    Object.entries(totals?.perDayShift[day] ?? {})
      .map(([id, n]) => `${shiftName(id) || '?'}: ${n}`)
      .join(' · ');
  /** How many shifts one member has this month (their row across all days). */
  const memberTotal = (r: (typeof rosterRows)[number]) =>
    dayList.reduce((sum, d) => sum + (r.days[d]?.length ?? 0), 0);
  /** ...and the same split by shift type, so "12 shifts" also says which. */
  const memberShiftTotal = (r: (typeof rosterRows)[number], shiftId: string) =>
    dayList.reduce(
      (sum, d) => sum + (r.days[d] ?? []).filter((c) => c.shift_id === shiftId).length,
      0,
    );
  /** One shift type's month total across every filtered member. */
  const shiftMonthTotal = (shiftId: string) =>
    dayList.reduce((sum, d) => sum + (totals?.perDayShift[d]?.[shiftId] ?? 0), 0);

  const daysInMonth = new Date(year, month, 0).getDate();
  const dayList = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Highlight today's column (server date) when the viewed month/year is current,
  // matching the attendance review grid.
  const today = useServerToday();
  const todayDay =
    today.slice(0, 7) === `${year}-${pad(month)}` ? Number(today.slice(8, 10)) : -1;

  useEffect(() => setPage(1), [branchId, year, month, search, field, departmentId]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refreshRoster = () => {
    qc.invalidateQueries({ queryKey: qk.rosterViewAll });
    qc.invalidateQueries({ queryKey: qk.monthlyAttendanceAll });
  };

  // Monthly roster upload via the options modal: rows = members (by CODE), cols =
  // days, cell = shift key(s). The chosen conflict mode decides how existing
  // (member, date, shift) assignments are handled (update / skip / fail).
  type RosterRow = { member_id: string; date: string; shift_id: string };
  const rosterImport = useMemo<ImportStrategy<RosterRow, { uploadedMembers: string[] }>>(() => {
    return {
      titleKey: 'rosters.monthly',
      accept: '.xlsx,.xls,.csv',
      modes: ['update', 'skip', 'fail'],
      defaultMode: 'update',
      previewColumns: [t('admin.memberCode'), t('admin.fullName'), t('import.colDays')],
      // Deferred so it doesn't read downloadTpl before its declaration below.
      downloadTemplate: () => downloadTpl(),
      prepare: async (file) => {
        const parsed = await parseSheet(file);
        const shiftByKey = new Map(
          shifts.filter((s) => s.key).map((s) => [String(s.key).trim().toLowerCase(), s.id]),
        );
        const all = await fetchAllPages((page, pageSize) =>
          listRosterForBranchMonth({
            branchId: uploadBranch,
            year: uploadYear,
            month: uploadMonth,
            page,
            pageSize,
            search: '',
            field: 'name',
          }),
        );
        const memberByCode = new Map(
          all.rows
            .filter((r) => r.member_code)
            .map((r) => [String(r.member_code).trim().toLowerCase(), r.member_id]),
        );
        const dim = new Date(uploadYear, uploadMonth, 0).getDate();
        const rows: RosterRow[] = [];
        const uploadedMembers = new Set<string>();
        const preview: ImportRowPreview[] = [];
        const unknownKeys = new Set<string>();
        let unmatched = 0;
        for (const r of parsed) {
          const code = String(r.code ?? '').trim();
          const memberId = memberByCode.get(code.toLowerCase());
          // How many day-cells this member row fills (for the preview).
          let filled = 0;
          for (let d = 1; d <= dim; d++) if (String(r[String(d)] ?? '').trim()) filled++;
          if (!memberId) {
            unmatched++;
            preview.push({
              cells: [code, String(r.full_name ?? '').trim(), String(filled)],
              status: 'invalid',
              error: t('rosters.importCodeNotFound'),
            });
            continue;
          }
          uploadedMembers.add(memberId);
          preview.push({
            cells: [code, String(r.full_name ?? '').trim(), String(filled)],
            status: 'new',
          });
          for (let d = 1; d <= dim; d++) {
            const cell = String(r[String(d)] ?? '').trim().toLowerCase();
            if (!cell) continue;
            const date = `${uploadYear}-${pad(uploadMonth)}-${pad(d)}`;
            const seen = new Set<string>();
            for (const token of cell.split(/[\s,/|]+/).filter(Boolean)) {
              const shiftId = shiftByKey.get(token);
              if (!shiftId) {
                unknownKeys.add(token); // a shift key that doesn't exist
                continue;
              }
              if (seen.has(shiftId)) continue;
              seen.add(shiftId);
              rows.push({ member_id: memberId, date, shift_id: shiftId });
            }
          }
        }
        const keyOf = (row: RosterRow) => `${row.member_id}|${row.date}|${row.shift_id}`;
        const existingKeys = new Set(
          await listRosterDayKeys([...uploadedMembers], uploadYear, uploadMonth),
        );
        const isExisting = (row: RosterRow) => existingKeys.has(keyOf(row));
        const existing = rows.filter(isExisting).length;
        const notes: string[] = [t('rosters.importAssignmentsNote')];
        if (unmatched) notes.push(t('rosters.importUnmatched', { count: unmatched }));
        if (unknownKeys.size)
          notes.push(t('rosters.importUnknownShifts', { keys: [...unknownKeys].join(', ') }));
        return {
          rows,
          preview,
          existing,
          fresh: rows.length - existing,
          invalid: unmatched,
          total: parsed.length,
          notes,
          isExisting,
          meta: { uploadedMembers: [...uploadedMembers] },
        };
      },
      apply: async (prep, mode) => {
        const rows = prep.rows;
        if (mode === 'fail' && prep.existing > 0) {
          return { created: 0, updated: 0, skipped: 0, failed: prep.existing };
        }
        const toWrite = mode === 'skip' ? rows.filter((r) => !prep.isExisting(r)) : rows;
        await upsertRosterDays(toWrite);
        // Uploading onto a department assigns everyone in the file to it.
        const meta = prep.meta;
        if (uploadDeptId && meta?.uploadedMembers.length) {
          await Promise.all(
            meta.uploadedMembers.map((id) =>
              setMemberDepartment(id, uploadYear, uploadMonth, uploadDeptId).catch(() => undefined),
            ),
          );
          qc.invalidateQueries({ queryKey: ['member-departments'] });
        }
        refreshRoster();
        return {
          created: mode === 'update' ? prep.fresh : toWrite.length,
          updated: mode === 'update' ? prep.existing : 0,
          skipped: mode === 'skip' ? prep.existing : 0,
          failed: 0,
        };
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadBranch, uploadYear, uploadMonth, shifts, uploadDeptId, qc, t]);

  /**
   * Export the roster for every member the CURRENT filters match.
   *
   * Per-shift columns and the closing totals are computed server-side over the
   * whole filtered set, not over the page on screen.
   */
  const printRoster = () =>
    serverExport('/roster/export', { year, month, branchId, search, field }, `roster_${year}_${pad(month)}`);

  // Build the rich monthly template for the selected month: Arabic day names on
  // top, the branch's members pre-filled with their current shifts, per-member
  // shift totals and per-day shift totals (Excel formulas). Re-uploadable.
  const downloadTpl = async () => {
    await showLoading({ message: t('common.processing') });
    try {
      const uploadDays = new Date(uploadYear, uploadMonth, 0).getDate();
      const all = await fetchAllPages((page, pageSize) =>
        listRosterForBranchMonth({
          branchId: uploadBranch,
          year: uploadYear,
          month: uploadMonth,
          page,
          pageSize,
          search: '',
          field: 'name',
        }),
      );
      await downloadRosterTemplate({
        year: uploadYear,
        month: uploadMonth,
        daysInMonth: uploadDays,
        shifts: shifts
          .filter((s) => s.key)
          .map((s) => ({ key: String(s.key).trim(), name: s.name })),
        members: all.rows.map((r) => ({
          code: r.member_code ?? '',
          full_name: r.full_name,
          // Join multiple shifts in a cell (e.g. "M N") for the template.
          days: Object.fromEntries(
            Object.entries(r.days).map(([d, cells]) => [d, cells.map((c) => c.label).join(' ')]),
          ) as Record<number, string>,
        })),
        filename: `roster_${uploadYear}_${pad(uploadMonth)}.xlsx`,
        labels: {
          code: t('admin.memberCode'),
          fullName: t('admin.fullName'),
          total: t('rosters.total'),
        },
      });
    } catch {
      present({ message: t('common.error'), duration: TOAST_MS.medium, color: 'danger' });
    } finally {
      await dismissLoading();
    }
  };

  // Tap a cell to ADD or REMOVE shifts for a member's day (a day may hold more
  // than one shift). Works even if attendance is already recorded.
  const editCell = (name: string, memberId: string, day: number, cells: RosterCell[]) => {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    const currentIds = new Set(cells.map((c) => c.shift_id));
    // No blocking loader: the day cell updates in the background (query refetch).
    const add = async (shiftId: string) => {
      try {
        await addRosterShift(memberId, dateStr, shiftId);
        refreshRoster();
        present({ message: t('common.saved'), duration: TOAST_MS.brief, color: 'success' });
      } catch {
        present({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
      }
    };
    const doRemove = async (shiftId: string) => {
      try {
        await removeRosterShift(memberId, dateStr, shiftId);
        refreshRoster();
        present({ message: t('common.saved'), duration: TOAST_MS.brief, color: 'success' });
      } catch {
        present({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
      }
    };
    const remove = async (shiftId: string) => {
      // Attendance is tied to the roster — removing this shift deletes its
      // attendance for the day. Warn first if there is any.
      const att = await getDayAttendance(memberId, dateStr).catch(() => []);
      const hit = att.find((a) => a.shift_id === shiftId && (a.check_in_at || a.check_out_at));
      if (hit) {
        presentAlert({
          header: t('rosters.removeShift'),
          message: t('rosters.removeShiftWarn'),
          buttons: [
            { text: t('common.cancel'), role: 'cancel' },
            { text: t('common.confirm'), role: 'destructive', handler: () => void doRemove(shiftId) },
          ],
        });
        return;
      }
      await doRemove(shiftId);
    };
    presentSheet({
      header: `${name} · ${day}/${pad(month)}`,
      buttons: [
        // Remove shifts already on this day.
        ...cells.map((c) => ({
          text: `${t('common.remove')} ${c.label}`,
          role: 'destructive' as const,
          handler: () => remove(c.shift_id),
        })),
        // Add any shift not already on this day.
        ...shifts
          .filter((s) => !currentIds.has(s.id))
          .map((s) => ({
            text: `${t('common.add')} ${s.name}${s.key ? ` (${s.key})` : ''}`,
            handler: () => add(s.id),
          })),
        { text: t('common.cancel'), role: 'cancel' as const },
      ],
    });
  };

  // Move a member from one department to another for the selected month (or clear
  // it). Departments come from the selected branch.
  const doTransfer = async (memberId: string, deptId: string | null) => {
    try {
      await setMemberDepartment(memberId, year, month, deptId);
      qc.invalidateQueries({ queryKey: qk.memberDepartments(year, month) });
      present({ message: t('common.saved'), duration: TOAST_MS.brief, color: 'success' });
    } catch {
      present({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
    }
  };
  const transferMember = (memberId: string, name: string) => {
    if (!departments.length) {
      present({ message: t('departments.pickBranchFirst'), duration: TOAST_MS.medium, color: 'warning' });
      return;
    }
    const current = memberDeptMap[memberId];
    presentSheet({
      header: `${name} · ${t('rosters.transferDept')}`,
      buttons: [
        ...departments.map((d) => ({
          text: d.id === current ? `✓ ${d.name}` : d.name,
          handler: () => void doTransfer(memberId, d.id),
        })),
        { text: t('common.none'), role: 'destructive' as const, handler: () => void doTransfer(memberId, null) },
        { text: t('common.cancel'), role: 'cancel' as const },
      ],
    });
  };

  const openBulk = () => {
    setBulkShift('');
    setBulkFrom(1);
    setBulkTo(daysInMonth);
    // Seed the modal's own filters from the current page filters, but they're
    // fully independent afterwards.
    setBulkBranch(branchId);
    setBulkDept(departmentId);
    setBulkSearch('');
    setBulkOpen(true);
  };
  const applyBulkRoster = async (mode: BulkRosterMode) => {
    if (!bulkBranch || !bulkShift) {
      present({ message: t('rosters.pickBranchToUpload'), duration: TOAST_MS.medium, color: 'warning' });
      return;
    }
    await showLoading({ message: t('common.processing') });
    try {
      const res = await bulkApplyRosterShift({
        branchId: bulkBranch,
        year,
        month,
        search: bulkSearch,
        field: 'name',
        shiftId: bulkShift,
        fromDay: bulkFrom,
        toDay: bulkTo,
        mode,
        departmentId: bulkDept || undefined,
      });
      refreshRoster();
      // The department assignments changed — refresh the per-member dept map.
      qc.invalidateQueries({ queryKey: ['member-departments'] });
      qc.invalidateQueries({ queryKey: qk.memberDepartments(year, month) });
      setBulkOpen(false);
      present({
        message: t('rosters.bulkResult', {
          count: res.members,
          added: res.added,
          removed: res.removed,
        }),
        duration: TOAST_MS.long,
        color: 'success',
      });
    } catch {
      present({ message: t('common.error'), duration: TOAST_MS.medium, color: 'danger' });
    } finally {
      await dismissLoading();
    }
  };

  // Removing a rostered shift deletes that shift's recorded attendance too (the
  // sync trigger), so the two destructive modes ask first.
  const askBulkRoster = (mode: BulkRosterMode) => {
    if (mode === 'add') {
      void applyBulkRoster(mode);
      return;
    }
    presentAlert({
      header: mode === 'remove' ? t('common.remove') : t('rosters.bulkReplace'),
      message: t('rosters.bulkDestructiveWarn'),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('common.confirm'), role: 'destructive', handler: () => void applyBulkRoster(mode) },
      ],
    });
  };

  return (
    <IonPage>
      <AdminHeader title={t('nav.rosters')}>
        {canOp('edit') && (
          <IonButton onClick={openBulk} title={t('rosters.bulkApply')}>
            <IonIcon slot="icon-only" icon={duplicateOutline} />
          </IonButton>
        )}
        {canOp('export') && (
          <IonButton onClick={printRoster} title={t('common.printReport')}>
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
          strategy={rosterImport}
          onClose={() => setImportOpen(false)}
        />
        <DetailsModal
          isOpen={!!details}
          title={details?.title ?? ''}
          rows={details?.rows ?? []}
          onClose={() => setDetails(null)}
        />

        <GridFilters
          month={month}
          year={year}
          branchId={branchId}
          branches={branches}
          field={field}
          search={search}
          onMonth={setMonth}
          onYear={setYear}
          onBranch={setBranchId}
          onField={setField}
          onSearch={setSearch}
          departments={departments}
          departmentId={departmentId}
          onDepartment={setDepartmentId}
        />

        {/* Self-contained monthly-roster upload (collapsed by default). */}
        {canOp('edit') && (
          <IonAccordionGroup className="ui-section">
            <IonAccordion value="upload">
              <IonItem slot="header" lines="none">
                <IonIcon slot="start" icon={cloudUploadOutline} color="primary" />
                <IonLabel>{t('rosters.monthly')}</IonLabel>
              </IonItem>
              <div slot="content" className="ui-surface" style={{ overflow: 'hidden' }}>
                {/* This upload flow has its OWN branch + month/year, independent
                    of the page's top filters. */}
                <IonItem lines="none">
                  <IonSelect
                    label={t('nav.branches')}
                    labelPlacement="stacked"
                    interface="popover"
                    placeholder={t('common.select')}
                    value={uploadBranch}
                    onIonChange={(e) => {
                      setUploadBranch(String(e.detail.value));
                      setUploadDeptId('');
                    }}
                  >
                    {branches.map((b) => (
                      <IonSelectOption key={b.id} value={b.id}>
                        {b.name}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <div className="grid-filter-row">
                  <IonItem lines="none">
                    <IonSelect
                      label={t('admin.month')}
                      labelPlacement="stacked"
                      interface="popover"
                      value={uploadMonth}
                      onIonChange={(e) => setUploadMonth(Number(e.detail.value))}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <IonSelectOption key={m} value={m}>
                          {m}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                  <IonItem lines="none">
                    <IonSelect
                      label={t('admin.year')}
                      labelPlacement="stacked"
                      interface="popover"
                      value={uploadYear}
                      onIonChange={(e) => setUploadYear(Number(e.detail.value))}
                    >
                      {[uploadYear - 1, uploadYear, uploadYear + 1].map((y) => (
                        <IonSelectOption key={y} value={y}>
                          {y}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                </div>
                {/* Required target department → assigns everyone in the sheet to it. */}
                <IonItem lines="none">
                  <IonSelect
                    label={`${t('rosters.uploadDepartment')} *`}
                    labelPlacement="stacked"
                    interface="popover"
                    placeholder={t('common.select')}
                    value={uploadDeptId}
                    disabled={!uploadBranch}
                    onIonChange={(e) => setUploadDeptId(String(e.detail.value))}
                  >
                    {uploadDepartments.map((d) => (
                      <IonSelectOption key={d.id} value={d.id}>
                        {d.name}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                {/* Download the pre-filled template, then upload the filled sheet. */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 12 }}>
                  <IonButton fill="outline" onClick={downloadTpl} disabled={!uploadBranch}>
                    <IonIcon slot="start" icon={downloadOutline} />
                    {t('common.template')}
                  </IonButton>
                  <IonButton onClick={() => setImportOpen(true)} disabled={!uploadBranch || !uploadDeptId}>
                    <IonIcon slot="start" icon={cloudUploadOutline} />
                    {t('rosters.upload')}
                  </IonButton>
                </div>
                {!uploadBranch ? (
                  <IonNote color="warning" className="ui-caption" style={{ display: 'block', padding: '0 14px 14px' }}>
                    {t('rosters.pickBranchToUpload')}
                  </IonNote>
                ) : !uploadDeptId ? (
                  <IonNote color="warning" className="ui-caption" style={{ display: 'block', padding: '0 14px 14px' }}>
                    {t('rosters.pickDeptToUpload')}
                  </IonNote>
                ) : (
                  <div className="ui-caption" style={{ padding: '0 14px 14px' }}>{t('rosters.monthlyHint')}</div>
                )}
              </div>
            </IonAccordion>
          </IonAccordionGroup>
        )}

        {/* View / edit assigned roster */}
        <SectionHeader title={t('rosters.view')} />
        {canOp('edit') && (
          <div className="ui-caption" style={{ padding: '0 14px 6px' }}>{t('rosters.tapHint')}</div>
        )}
        <div className="ui-surface ui-section" style={{ marginTop: 0, overflow: 'hidden' }}>
          {/* What this table shows + the shift-key legend for the cells. */}
          <GridSummary
            branchName={branches.find((b) => b.id === branchId)?.name}
            month={month}
            year={year}
            departmentName={departments.find((d) => d.id === departmentId)?.name}
            showDepartment
            count={total}
          />
          {shifts.length > 0 && (
            <div className="status-legend" style={{ paddingTop: 4 }}>
              {shifts.map((s) => (
                <span className="status-legend__item" key={s.id}>
                  <span
                    className="status-legend__mark"
                    style={{
                      background: 'var(--ion-color-primary)',
                      color: '#fff',
                      borderColor: 'var(--ion-color-primary)',
                    }}
                  >
                    {s.key || '•'}
                  </span>
                  <span className="ui-caption">{s.name}</span>
                </span>
              ))}
            </div>
          )}
          {rosterLoading ? (
            <div style={{ padding: 14 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <IonSkeletonText animated style={{ width: 120, height: 22, flexShrink: 0, borderRadius: 4 }} />
                  <IonSkeletonText animated style={{ width: '100%', height: 22, borderRadius: 4 }} />
                </div>
              ))}
            </div>
          ) : rosterRows.length === 0 ? (
            <EmptyState icon={calendarNumberOutline} title={t('attendance.noRecords')} />
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="roster-grid ltr-nums">
                  <thead>
                    <tr>
                      <th className="roster-sticky">{t('rosters.member')}</th>
                      {dayList.map((d) => (
                        <th key={d} className={d === todayDay ? 'roster-today' : ''}>
                          {d}
                        </th>
                      ))}
                      {shifts.map((sh) => (
                        <th key={sh.id} className="roster-total" title={sh.name}>
                          {sh.key || sh.name}
                        </th>
                      ))}
                      <th className="roster-total">{t('rosters.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterRows.map((r) => (
                      <tr key={r.member_id}>
                        <td
                          className="roster-sticky"
                          title={r.national_id}
                          style={{ cursor: canOp('edit') ? 'pointer' : 'default' }}
                          onClick={() => canOp('edit') && transferMember(r.member_id, r.full_name)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <IonButton
                              size="small"
                              fill="clear"
                              style={{ margin: 0, height: 22 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetails({
                                  title: r.full_name,
                                  rows: [
                                    { label: t('admin.fullName'), value: r.full_name },
                                    { label: t('import.colNationalId'), value: r.national_id },
                                    { label: t('admin.memberCode'), value: r.member_code },
                                    { label: t('nav.departments'), value: deptNameOf(r.member_id) },
                                    { label: t('nav.branches'), value: branches.find((h) => h.id === branchId)?.name },
                                  ],
                                });
                              }}
                            >
                              <IonIcon slot="icon-only" icon={informationCircleOutline} style={{ fontSize: 18 }} />
                            </IonButton>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', unicodeBidi: 'plaintext' }}>
                              {r.full_name}
                            </span>
                          </div>
                          {deptNameOf(r.member_id) && (
                            <div className="ui-caption">{deptNameOf(r.member_id)}</div>
                          )}
                        </td>
                        {dayList.map((d) => {
                          const cells = r.days[d] ?? [];
                          return (
                            <td
                              key={d}
                              className={`${cells.length ? 'roster-on' : ''}${d === todayDay ? ' roster-today' : ''}`.trim()}
                              style={{ cursor: canOp('edit') ? 'pointer' : 'default' }}
                              onClick={() => canOp('edit') && editCell(r.full_name, r.member_id, d, cells)}
                            >
                              {cells.map((c) => c.label).join(' ')}
                            </td>
                          );
                        })}
                        {shifts.map((sh) => (
                          <td key={sh.id} className="roster-total">
                            {memberShiftTotal(r, sh.id)}
                          </td>
                        ))}
                        <td className="roster-total">{memberTotal(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {/* One row per shift type, then the combined row. */}
                    {shifts.map((sh) => (
                      <tr key={sh.id}>
                        <td className="roster-sticky roster-total">{sh.name}</td>
                        {dayList.map((d) => (
                          <td
                            key={d}
                            className={`roster-total${d === todayDay ? ' roster-today' : ''}`}
                          >
                            {totals?.perDayShift[d]?.[sh.id] ?? 0}
                          </td>
                        ))}
                        {shifts.map((other) => (
                          <td key={other.id} className="roster-total">
                            {other.id === sh.id ? shiftMonthTotal(sh.id) : ''}
                          </td>
                        ))}
                        <td className="roster-total">{shiftMonthTotal(sh.id)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="roster-sticky roster-total">{t('rosters.total')}</td>
                      {dayList.map((d) => (
                        <td
                          key={d}
                          className={`roster-total${d === todayDay ? ' roster-today' : ''}`}
                          title={dayBreakdown(d)}
                        >
                          {totals?.perDay[d] ?? 0}
                        </td>
                      ))}
                      {shifts.map((sh) => (
                        <td key={sh.id} className="roster-total">
                          {shiftMonthTotal(sh.id)}
                        </td>
                      ))}
                      <td className="roster-total">{totals?.total ?? 0}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <Pager page={page} pages={pages} onPage={setPage} />
            </>
          )}
        </div>

        {/* Bulk apply/clear a shift across a day range for all filtered members */}
        <IonModal isOpen={bulkOpen} onDidDismiss={() => setBulkOpen(false)}>
          <AdminHeader title={t('rosters.bulkApply')}>
            <IonButton onClick={() => setBulkOpen(false)}>{t('common.cancel')}</IonButton>
          </AdminHeader>
          <IonContent className="ion-padding">
            <IonNote className="ui-caption" style={{ display: 'block', marginBottom: 10 }}>
              {t('rosters.bulkApplyHint')}
            </IonNote>
            <IonList>
              {/* The modal's OWN branch (independent of the page's top filter). */}
              <IonItem>
                <IonSelect
                  label={t('nav.branches')}
                  labelPlacement="stacked"
                  interface="popover"
                  placeholder={t('common.select')}
                  value={bulkBranch}
                  onIonChange={(e) => {
                    setBulkBranch(String(e.detail.value));
                    setBulkDept(''); // reset dept when branch changes
                  }}
                >
                  {branches.map((b) => (
                    <IonSelectOption key={b.id} value={b.id}>
                      {b.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonSelect
                  label={t('nav.shifts')}
                  labelPlacement="stacked"
                  placeholder={t('common.select')}
                  value={bulkShift}
                  onIonChange={(e) => setBulkShift(String(e.detail.value))}
                >
                  {shifts.map((s) => (
                    <IonSelectOption key={s.id} value={s.id}>
                      {s.name}
                      {s.key ? ` (${s.key})` : ''}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              {/* The department to UPLOAD this roster onto for the month — the
                  affected members get assigned to it (optional). */}
              <IonItem>
                <IonSelect
                  label={t('nav.departments')}
                  labelPlacement="stacked"
                  interface="popover"
                  placeholder={t('common.none')}
                  value={bulkDept}
                  disabled={!bulkBranch}
                  onIonChange={(e) => setBulkDept(String(e.detail.value))}
                >
                  <IonSelectOption value="">{t('common.none')}</IonSelectOption>
                  {bulkDepartments.map((d) => (
                    <IonSelectOption key={d.id} value={d.id}>
                      {d.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              {/* The modal's OWN name search (independent of the top filter). */}
              <IonItem>
                <IonInput
                  label={t('common.search')}
                  labelPlacement="stacked"
                  placeholder={t('admin.byName')}
                  value={bulkSearch}
                  onIonInput={(e) => setBulkSearch(e.detail.value ?? '')}
                />
              </IonItem>
              <div className="grid-filter-row">
                <IonItem lines="none">
                  <IonSelect
                    label={t('rosters.fromDay')}
                    labelPlacement="stacked"
                    interface="popover"
                    value={bulkFrom}
                    onIonChange={(e) => setBulkFrom(Number(e.detail.value))}
                  >
                    {dayList.map((d) => (
                      <IonSelectOption key={d} value={d}>
                        {d}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem lines="none">
                  <IonSelect
                    label={t('rosters.toDay')}
                    labelPlacement="stacked"
                    interface="popover"
                    value={bulkTo}
                    onIonChange={(e) => setBulkTo(Number(e.detail.value))}
                  >
                    {dayList.map((d) => (
                      <IonSelectOption key={d} value={d}>
                        {d}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
              </div>
            </IonList>
            <IonButton
              expand="block"
              className="ion-margin-top"
              onClick={() => askBulkRoster('add')}
              disabled={!bulkShift}
            >
              {t('common.add')}
            </IonButton>
            <IonButton
              expand="block"
              fill="outline"
              onClick={() => askBulkRoster('replace')}
              disabled={!bulkShift}
            >
              {t('rosters.bulkReplace')}
            </IonButton>
            <IonButton
              expand="block"
              fill="outline"
              color="danger"
              onClick={() => askBulkRoster('remove')}
              disabled={!bulkShift}
            >
              {t('common.remove')}
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
