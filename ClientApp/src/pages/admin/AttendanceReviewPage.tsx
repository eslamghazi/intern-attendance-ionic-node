import { useEffect, useState } from 'react';
import {
  IonButton,
  IonChip,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  useIonActionSheet,
  useIonToast,
} from '@ionic/react';
import { documentTextOutline, downloadOutline, warningOutline } from 'ionicons/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useServerExport } from '../../components/useServerExport';
import { listBranchOptions } from '../../lib/api/catalog';
import { listDepartmentOptions } from '../../lib/api/departments';
import {
  clearAttendance,
  getAttendanceDetail,
  getDayAttendance,
  getDayShifts,
  listMonthlyAttendance,
  type MonthlyAttendanceRow,
  setAttendance,
  type DailyStatus,
  type ReviewRow,
} from '../../lib/api/attendance';
import type { SearchField } from '../../lib/api/members';
import type { BypassInfo } from '../../lib/types';
import { qk } from '../../lib/api/keys';
import { useServerToday } from '../../lib/useServerToday';
import { appToday } from '../../lib/clock';
import { usePermissions } from '../../lib/usePermissions';
import { formatTime } from '../../lib/date';
import { signedUrl } from '../../lib/face/images';
import { FILE_KINDS, MAP, PAGE_SIZE, TOAST_MS } from '../../lib/config';
import { fetchAllPages } from '../../lib/pagination';
import AdminHeader from '../../components/AdminHeader';
import GridFilters from '../../components/admin/GridFilters';
import GridSummary from '../../components/admin/GridSummary';
import { STATUS_COLOR } from '../../components/StatusBadge';
import MapPicker from '../../components/MapPicker';
import EmptyState from '../../components/ui/EmptyState';
import StatusLegend from '../../components/StatusLegend';
import ListSkeleton from '../../components/ui/ListSkeleton';
import Pager from '../../components/ui/Pager';

const pad = (n: number) => String(n).padStart(2, '0');
const isCame = (s: DailyStatus) => s !== 'pending' && s !== 'absent'; // checked in
const isOnTime = (s: DailyStatus) => isCame(s) && s !== 'late';
const statusMark = (s: DailyStatus) => STATUS_COLOR[s]?.mark ?? '';
/** Marker for the CHECK-OUT dimension shown under the check-in mark. */
const coMark = (o: string | null | undefined) =>
  o === 'left_work' || o === 'early_leave' ? (STATUS_COLOR[o]?.mark ?? '') : '';

type Filter = 'all' | 'present' | 'late' | 'pending' | 'absent';

function Tally({
  color,
  label,
  value,
  active,
  onClick,
}: {
  color: string;
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        textAlign: 'center',
        background: active ? `${color}1f` : 'transparent',
        border: active ? `1px solid ${color}` : '1px solid transparent',
        borderRadius: 10,
        padding: '6px 4px',
        cursor: 'pointer',
      }}
    >
      <div className="ui-value" style={{ color, fontSize: '1.4rem' }}>
        {value}
      </div>
      <div className="ui-caption">{label}</div>
    </button>
  );
}

export default function AttendanceReviewPage() {
  const { t } = useTranslation();
  const serverExport = useServerExport();
  const qc = useQueryClient();
  const { canOp } = usePermissions('review');
  const [presentToast] = useIonToast();
  const [presentSheet] = useIonActionSheet();
  // Default to the current Cairo month/year from the single app clock.
  const nowDate = appToday(); // yyyy-mm-dd
  const [month, setMonth] = useState(Number(nowDate.slice(5, 7)));
  const [year, setYear] = useState(Number(nowDate.slice(0, 4)));
  const [branchId, setBranchId] = useState<string>('');
  const [field, setField] = useState<SearchField>('name');
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReviewRow | null>(null);
  const [probeUrl, setProbeUrl] = useState<string | null>(null);
  const [probeOutUrl, setProbeOutUrl] = useState<string | null>(null);

  const { data: branches = [] } = useQuery({
    queryKey: qk.branchOptions,
    queryFn: listBranchOptions,
  });
  const { data: departments = [] } = useQuery({
    queryKey: [...qk.departmentOptions, branchId],
    queryFn: () => listDepartmentOptions(branchId),
  });
  // The month tally needs every member, so we fetch the whole month once
  // (keyed without page) and paginate the display client-side — this keeps the
  // totals stable across pages.
  const { data, isLoading, refetch } = useQuery({
    queryKey: qk.monthlyAttendance(branchId, year, month, 0, search, field, departmentId),
    queryFn: () =>
      // The matrix totals are over EVERY member the filters match, so this
      // walks the pages rather than asking for one oversized page.
      fetchAllPages((page, pageSize) =>
        listMonthlyAttendance({ branchId, year, month, page, pageSize, search, field, departmentId }),
      ),
  });
  const allRows = data?.rows ?? [];

  const daysInMonth = new Date(year, month, 0).getDate();
  const dayList = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const today = useServerToday();
  const todayDay =
    today.slice(0, 7) === `${year}-${pad(month)}` ? Number(today.slice(8, 10)) : -1;

  // Global tallies across all members in the month.
  let present = 0;
  let late = 0;
  let pending = 0;
  let absent = 0;
  for (const r of allRows) {
    for (const arr of Object.values(r.days)) {
      for (const d of arr) {
        if (d === 'pending') pending++;
        else if (d === 'absent') absent++;
        else if (d === 'late') late++;
        else present++;
      }
    }
  }
  // Representative status of a multi-shift cell (most concerning first) — used
  // for the cell background and the daily filter.
  const SEVERITY: DailyStatus[] = ['absent', 'late', 'left_work', 'early_leave', 'pending', 'present'];
  const repOf = (list: DailyStatus[]): DailyStatus =>
    SEVERITY.find((s) => list.includes(s)) ?? list[0];

  useEffect(() => setPage(1), [branchId, year, month, search, field, departmentId]);
  // Totals are computed over allRows (every member the filters match), not the
  // twelve on screen — the question "how many attended on the 12th" is about the
  // whole set. Paging here is client-side, so this costs nothing extra.
  const ATTENDED: DailyStatus[] = ['present', 'late'];
  const countIn = (list: DailyStatus[] | undefined, of: DailyStatus[]) =>
    (list ?? []).filter((s) => of.includes(s)).length;
  /** attended slots / rostered slots for one member across the month. */
  const memberTotals = (r: MonthlyAttendanceRow) => {
    let attended = 0;
    let slots = 0;
    for (const d of dayList) {
      const list = r.days[d] ?? [];
      slots += list.length;
      attended += countIn(list, ATTENDED);
    }
    return { attended, slots };
  };
  const dayAttended = (d: number) => allRows.reduce((sum, r) => sum + countIn(r.days[d], ATTENDED), 0);
  const dayBreakdown = (d: number) => {
    const counts: Record<string, number> = {};
    for (const r of allRows) for (const s of r.days[d] ?? []) counts[s] = (counts[s] ?? 0) + 1;
    return Object.entries(counts)
      .map(([s, n]) => `${t(`attendance.${s}`)}: ${n}`)
      .join(' · ');
  };
  const grandAttended = dayList.reduce((sum, d) => sum + dayAttended(d), 0);

  const pages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const rows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const matches = (s: DailyStatus) =>
    filter === 'all'
      ? true
      : filter === 'present'
        ? isOnTime(s)
        : filter === 'late'
          ? s === 'late'
          : filter === 'pending'
            ? s === 'pending'
            : s === 'absent';

  /**
   * Export the matrix for every member the CURRENT filters match.
   *
   * The day columns, the colour per cell and the worst-of-the-day rule are the
   * server's now (domain/report/matrix.ts) — the same module the grid reads —
   * so the file and the screen cannot disagree about a mixed day.
   */
  const printReview = () =>
    serverExport(
      '/attendance/monthly/export',
      { year, month, branchId, search, field, departmentId },
      `attendance_${year}_${pad(month)}`,
    );

  const openDetail = async (memberId: string, dateStr: string, shiftId?: string | null) => {
    setProbeUrl(null);
    setProbeOutUrl(null);
    const detail = await getAttendanceDetail(memberId, dateStr, shiftId);
    if (!detail) return;
    setSelected(detail);
    if (detail.check_in_probe_path) {
      setProbeUrl(await signedUrl(FILE_KINDS.probes, detail.check_in_probe_path));
    }
    if (detail.check_out_probe_path) {
      setProbeOutUrl(await signedUrl(FILE_KINDS.probes, detail.check_out_probe_path));
    }
  };

  const refresh = () => qc.invalidateQueries({ queryKey: qk.monthlyAttendanceAll });

  // No blocking loader on cell edits: the change refetches in the background
  // (isLoading-gated skeleton only shows on first load) and a brief toast
  // confirms — the grid stays on screen instead of reloading from the start.
  const mark = async (
    memberId: string,
    dateStr: string,
    status: 'present' | 'late' | 'absent',
    shiftId?: string | null,
  ) => {
    try {
      await setAttendance(memberId, dateStr, status, shiftId);
      refresh();
      presentToast({ message: t('common.saved'), duration: TOAST_MS.brief, color: 'success' });
    } catch {
      presentToast({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
    }
  };

  const clearCell = async (memberId: string, dateStr: string, shiftId?: string | null) => {
    try {
      await clearAttendance(memberId, dateStr, shiftId);
      refresh();
      presentToast({ message: t('common.saved'), duration: TOAST_MS.brief, color: 'success' });
    } catch {
      presentToast({ message: t('common.error'), duration: TOAST_MS.short, color: 'danger' });
    }
  };

  // The present/details/clear action sheet for ONE shift of a day.
  const showActions = (
    name: string,
    memberId: string,
    dateStr: string,
    shift: { id: string | null; name: string },
    status: DailyStatus | undefined,
  ) => {
    const editable = canOp('edit');
    presentSheet({
      header: shift.name ? `${name} · ${shift.name}` : `${name} · ${dateStr}`,
      buttons: [
        ...(editable
          ? [
              { text: t('attendance.present'), handler: () => mark(memberId, dateStr, 'present', shift.id) },
              { text: t('attendance.late'), handler: () => mark(memberId, dateStr, 'late', shift.id) },
              { text: t('attendance.absent'), role: 'destructive' as const, handler: () => mark(memberId, dateStr, 'absent', shift.id) },
            ]
          : []),
        ...(status && isCame(status)
          ? [{ text: t('common.details'), handler: () => openDetail(memberId, dateStr, shift.id) }]
          : []),
        ...(editable && status && status !== 'pending'
          ? [{ text: t('common.clear'), handler: () => clearCell(memberId, dateStr, shift.id) }]
          : []),
        { text: t('common.cancel'), role: 'cancel' as const },
      ],
    });
  };

  // Tap a day cell to explicitly take/override attendance. When the day has more
  // than one shift, first choose which shift, then act on it.
  const openCell = async (name: string, memberId: string, day: number) => {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    const [shifts, atts] = await Promise.all([
      getDayShifts(memberId, dateStr).catch(() => []),
      getDayAttendance(memberId, dateStr).catch(() => []),
    ]);
    // Distinct shifts for this day (rostered + any recorded), with each one's
    // current status (from its attendance row).
    const byId = new Map<string | null, { id: string | null; name: string; status?: DailyStatus }>();
    for (const s of shifts) byId.set(s.id, { id: s.id, name: s.name });
    for (const a of atts) {
      const cur = byId.get(a.shift_id) ?? { id: a.shift_id, name: a.shift_name ?? '—' };
      cur.status = a.status;
      byId.set(a.shift_id, cur);
    }
    const list = [...byId.values()];

    if (list.length > 1) {
      presentSheet({
        header: `${name} · ${day}/${pad(month)}`,
        subHeader: t('attendance.pickShift'),
        buttons: [
          ...list.map((s) => ({
            text: `${s.name}${s.status ? ` — ${t(`attendance.${s.status}`)}` : ''}`,
            handler: () => showActions(name, memberId, dateStr, s, s.status),
          })),
          { text: t('common.cancel'), role: 'cancel' as const },
        ],
      });
      return;
    }
    const only = list[0] ?? { id: null, name: '' };
    showActions(name, memberId, dateStr, only, only.status);
  };

  // Which gates were bypassed for a check-in/out, as warning chips (null = none).
  const bypassChips = (b: BypassInfo | null) => {
    if (!b) return null;
    const labels: string[] = [];
    if (b.location)
      labels.push(
        t('attendance.bypassLocation') +
          (b.source ? ` · ${t(`attendance.bypassSource_${b.source}`)}` : ''),
      );
    if (b.face) labels.push(t('attendance.bypassFace'));
    if (b.shift_window) labels.push(t('attendance.bypassShiftWindow'));
    if (!labels.length) return null;
    return (
      <div style={{ margin: '2px 6px 10px' }}>
        <IonNote style={{ display: 'block', marginBottom: 4 }}>{t('attendance.bypass')}</IonNote>
        {labels.map((l) => (
          <IonChip key={l} color="warning">
            <IonIcon icon={warningOutline} />
            <IonLabel>{l}</IonLabel>
          </IonChip>
        ))}
      </div>
    );
  };

  return (
    <IonPage>
      <AdminHeader title={t('nav.review')}>
        {canOp('export') && (
          <IonButton onClick={printReview} title={t('common.printReport')}>
            <IonIcon slot="icon-only" icon={downloadOutline} />
          </IonButton>
        )}
      </AdminHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => refetch().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

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

        {rows.length > 0 && (
          <div className="ui-surface ui-section" style={{ display: 'flex', gap: 6, padding: '10px 8px' }}>
            <Tally
              color="#6b7280"
              label={t('common.all')}
              value={present + pending + absent}
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <Tally
              color={STATUS_COLOR.present.solid}
              label={t('attendance.present')}
              value={present}
              active={filter === 'present'}
              onClick={() => setFilter('present')}
            />
            <Tally
              color={STATUS_COLOR.late.solid}
              label={t('attendance.late')}
              value={late}
              active={filter === 'late'}
              onClick={() => setFilter('late')}
            />
            <Tally
              color={STATUS_COLOR.pending.solid}
              label={t('attendance.pending')}
              value={pending}
              active={filter === 'pending'}
              onClick={() => setFilter('pending')}
            />
            <Tally
              color={STATUS_COLOR.absent.solid}
              label={t('attendance.absent')}
              value={absent}
              active={filter === 'absent'}
              onClick={() => setFilter('absent')}
            />
          </div>
        )}

        {isLoading ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={documentTextOutline} title={t('attendance.noRecords')} />
        ) : (
          <>
            {/* What this table shows + key of what each mark/colour means. */}
            <div className="ui-surface ui-section" style={{ marginTop: 0 }}>
              <GridSummary
                branchName={branches.find((b) => b.id === branchId)?.name}
                month={month}
                year={year}
                departmentName={departments.find((d) => d.id === departmentId)?.name}
                showDepartment
                count={allRows.length}
              />
              <StatusLegend />
            </div>
            {canOp('edit') && (
              <div className="ui-caption" style={{ padding: '0 14px 6px' }}>{t('attendance.tapHint')}</div>
            )}
            <div className="ui-surface ui-section" style={{ marginTop: 0, overflowX: 'auto' }}>
              <table className="roster-grid ltr-nums">
                <thead>
                  <tr>
                    <th className="roster-sticky">{t('rosters.member')}</th>
                    {dayList.map((d) => (
                      <th key={d} className={d === todayDay ? 'roster-today' : ''}>
                        {d}
                      </th>
                    ))}
                    <th className="roster-total">{t('rosters.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.member_id}>
                      <td className="roster-sticky" title={r.national_id}>
                        {r.full_name}
                      </td>
                      {dayList.map((d) => {
                        const list = r.days[d];
                        const todayCol = d === todayDay;
                        if (!list?.length)
                          return (
                            <td
                              key={d}
                              className={todayCol ? 'roster-today' : ''}
                              style={{ cursor: 'pointer' }}
                              onClick={() => void openCell(r.full_name, r.member_id, d)}
                            />
                          );
                        const rep = repOf(list);
                        const c = STATUS_COLOR[rep] ?? STATUS_COLOR.pending;
                        const dim = filter !== 'all' && !list.some(matches);
                        const co = r.checkouts[d] ?? [];
                        const hasCo = co.some((x) => coMark(x));
                        return (
                          <td
                            key={d}
                            className={todayCol ? 'roster-today' : ''}
                            onClick={() => void openCell(r.full_name, r.member_id, d)}
                            style={{
                              background: c.bg,
                              color: c.fg,
                              fontWeight: 700,
                              opacity: dim ? 0.18 : 1,
                              cursor: 'pointer',
                            }}
                          >
                            {list.map(statusMark).join(' ')}
                            {hasCo && (
                              <div style={{ fontSize: '0.66em', opacity: 0.9, lineHeight: 1, marginTop: 1 }}>
                                {co.map(coMark).join(' ')}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="roster-total">
                        {memberTotals(r).attended}/{memberTotals(r).slots}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="roster-sticky roster-total">{t('rosters.total')}</td>
                    {dayList.map((d) => (
                      <td
                        key={d}
                        className={`roster-total${d === todayDay ? ' roster-today' : ''}`}
                        title={dayBreakdown(d)}
                      >
                        {dayAttended(d)}
                      </td>
                    ))}
                    <td className="roster-total">{grandAttended}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <Pager page={page} pages={pages} onPage={setPage} />
          </>
        )}

        <IonModal isOpen={!!selected} onDidDismiss={() => setSelected(null)}>
          <AdminHeader title={selected?.member?.profile?.full_name ?? ''}>
            <IonButton onClick={() => setSelected(null)}>{t('common.close')}</IonButton>
          </AdminHeader>
          <IonContent className="ion-padding">
            {selected && (
              <>
                {/* Summary */}
                <IonList>
                  <IonItem>
                    <IonLabel>{t('attendance.date')}</IonLabel>
                    <IonNote slot="end" className="ltr-nums">{selected.date}</IonNote>
                  </IonItem>
                  {selected.shift_name && (
                    <IonItem>
                      <IonLabel>{t('attendance.shift')}</IonLabel>
                      <IonNote slot="end">{selected.shift_name}</IonNote>
                    </IonItem>
                  )}
                  <IonItem>
                    <IonLabel>{t('attendance.status')}</IonLabel>
                    <IonNote slot="end">{t(`attendance.${selected.status}`)}</IonNote>
                  </IonItem>
                </IonList>

                {/* Check-in */}
                <div style={{ fontWeight: 700, margin: '16px 6px 6px' }}>{t('shifts.checkin')}</div>
                <IonList>
                  <IonItem>
                    <IonLabel>{t('attendance.checkInAt')}</IonLabel>
                    <IonNote slot="end" className="ltr-nums">{formatTime(selected.check_in_at)}</IonNote>
                  </IonItem>
                  <IonItem>
                    <IonLabel>{t('attendance.distance')}</IonLabel>
                    <IonNote slot="end" className="ltr-nums">{selected.check_in_distance_m ?? '—'} m</IonNote>
                  </IonItem>
                  <IonItem>
                    <IonLabel>{t('attendance.accuracy')}</IonLabel>
                    <IonNote slot="end" className="ltr-nums">{selected.check_in_accuracy_m ?? '—'} m</IonNote>
                  </IonItem>
                  <IonItem>
                    <IonLabel>{t('attendance.faceScore')}</IonLabel>
                    <IonNote slot="end" className="ltr-nums">{selected.check_in_face_score?.toFixed(3) ?? '—'}</IonNote>
                  </IonItem>
                  <IonItem>
                    <IonLabel>{t('attendance.mock')}</IonLabel>
                    <IonNote slot="end">{selected.check_in_is_mock ? t('common.yes') : t('common.no')}</IonNote>
                  </IonItem>
                </IonList>
                {bypassChips(selected.check_in_bypass)}
                {probeUrl && (
                  <div style={{ textAlign: 'center', margin: '12px 0' }}>
                    <IonNote>{t('admin.probePhoto')}</IonNote>
                    <br />
                    <img src={probeUrl} alt="probe" style={{ maxWidth: 220, borderRadius: 8, marginTop: 8 }} />
                  </div>
                )}
                {selected.check_in_lat != null && (
                  <MapPicker
                    lat={selected.check_in_lat}
                    lng={selected.check_in_lng}
                    radius={MAP.reviewRadiusMeters}
                    onChange={() => undefined}
                    height={MAP.reviewHeight}
                    readOnly
                  />
                )}

                {/* Check-out (only when recorded) */}
                {selected.check_out_at && (
                  <>
                    <div style={{ fontWeight: 700, margin: '18px 6px 6px' }}>{t('shifts.checkout')}</div>
                    <IonList>
                      <IonItem>
                        <IonLabel>{t('attendance.checkOutAt')}</IonLabel>
                        <IonNote slot="end" className="ltr-nums">{formatTime(selected.check_out_at)}</IonNote>
                      </IonItem>
                      <IonItem>
                        <IonLabel>{t('attendance.distance')}</IonLabel>
                        <IonNote slot="end" className="ltr-nums">{selected.check_out_distance_m ?? '—'} m</IonNote>
                      </IonItem>
                      <IonItem>
                        <IonLabel>{t('attendance.accuracy')}</IonLabel>
                        <IonNote slot="end" className="ltr-nums">{selected.check_out_accuracy_m ?? '—'} m</IonNote>
                      </IonItem>
                      <IonItem>
                        <IonLabel>{t('attendance.faceScore')}</IonLabel>
                        <IonNote slot="end" className="ltr-nums">{selected.check_out_face_score?.toFixed(3) ?? '—'}</IonNote>
                      </IonItem>
                      <IonItem>
                        <IonLabel>{t('attendance.mock')}</IonLabel>
                        <IonNote slot="end">{selected.check_out_is_mock ? t('common.yes') : t('common.no')}</IonNote>
                      </IonItem>
                    </IonList>
                    {bypassChips(selected.check_out_bypass)}
                    {probeOutUrl && (
                      <div style={{ textAlign: 'center', margin: '12px 0' }}>
                        <IonNote>{t('admin.probePhoto')}</IonNote>
                        <br />
                        <img src={probeOutUrl} alt="probe" style={{ maxWidth: 220, borderRadius: 8, marginTop: 8 }} />
                      </div>
                    )}
                    {selected.check_out_lat != null && (
                      <MapPicker
                        lat={selected.check_out_lat}
                        lng={selected.check_out_lng}
                        radius={MAP.reviewRadiusMeters}
                        onChange={() => undefined}
                        height={MAP.reviewHeight}
                    readOnly
                      />
                    )}
                  </>
                )}
              </>
            )}
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
