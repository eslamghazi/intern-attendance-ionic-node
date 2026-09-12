import { useEffect, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
} from '@ionic/react';
import {
  businessOutline,
  calendarOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  downloadOutline,
  hourglassOutline,
  peopleOutline,
  statsChartOutline,
  timeOutline,
} from 'ionicons/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listGroupOptions, listBranchOptions, listShifts } from '../../lib/api/catalog';
import { listDepartmentOptions } from '../../lib/api/departments';
import { countActiveMembers } from '../../lib/api/members';
import { getMonthStats, type StatsFilter } from '../../lib/api/attendance';
import { qk } from '../../lib/api/keys';
import { formatMonth } from '../../lib/date';
import { MONTHS } from '../../lib/config';
import { useServerToday } from '../../lib/useServerToday';
import { usePermissions } from '../../lib/usePermissions';
import AdminHeader from '../../components/AdminHeader';
import BrandHeader from '../../components/BrandHeader';
import ServerClock from '../../components/ServerClock';
import Copyright from '../../components/Copyright';
import ThemeToggle from '../../components/ThemeToggle';
import LanguageToggle from '../../components/LanguageToggle';
import { useServerExport } from '../../components/useServerExport';
import { STATUS_COLOR } from '../../components/StatusBadge';
import StatTile from '../../components/ui/StatTile';
import DonutStat from '../../components/ui/DonutStat';
import TrendChart from '../../components/ui/TrendChart';
import GaugeChart from '../../components/ui/GaugeChart';
import PieChart from '../../components/ui/PieChart';
import ColumnChart from '../../components/ui/ColumnChart';
import StackedBar from '../../components/ui/StackedBar';
import HeatmapChart from '../../components/ui/HeatmapChart';
import RadarChart from '../../components/ui/RadarChart';
import PolarAreaChart from '../../components/ui/PolarAreaChart';
import ScatterBubbleChart from '../../components/ui/ScatterBubbleChart';
import SectionHeader from '../../components/ui/SectionHeader';

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      {label}
      <span className="ltr-nums ui-muted">{value}</span>
    </div>
  );
}

/** Placeholder shown while the month's numbers are being fetched — the page
 *  keeps its shape instead of collapsing to the filters and jumping when the
 *  data lands. */
function DashboardSkeleton() {
  return (
    <div className="ui-section" aria-hidden="true">
      <div className="ui-surface" style={{ padding: 18, textAlign: 'center' }}>
        <IonSkeletonText animated style={{ width: 160, height: 160, borderRadius: '50%', margin: '0 auto' }} />
        <IonSkeletonText animated style={{ width: '50%', height: 12, margin: '14px auto 0' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="ui-surface" style={{ padding: 16 }}>
            <IonSkeletonText animated style={{ width: '45%', height: 22 }} />
            <IonSkeletonText animated style={{ width: '70%', height: 11, marginTop: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const date = useServerToday();
  const serverExport = useServerExport();
  const { canOp } = usePermissions('dashboard');

  // Filters.
  const [month, setMonth] = useState(Number(date.slice(5, 7)));
  const [year, setYear] = useState(Number(date.slice(0, 4)));
  const [day, setDay] = useState<number | null>(null); // null = whole month
  const [branchId, setBranchId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  // Which chart panels to show — the admin can pick several at once. Only the
  // donut shows by default; everything else is opt-in.
  type ChartKey =
    | 'donut'
    | 'gauge'
    | 'statusPie'
    | 'trendBar'
    | 'trendLine'
    | 'heatmap'
    | 'stacked'
    | 'radar'
    | 'polar'
    | 'bubble'
    | 'scatter'
    | 'branch'
    | 'group'
    | 'shift';
  const [charts, setCharts] = useState<ChartKey[]>(['donut']);
  const showChart = (k: ChartKey) => charts.includes(k);

  const daysInMonth = new Date(year, month, 0).getDate();
  const dayList = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const baseYear = Number(date.slice(0, 4));
  const years = [baseYear - 3, baseYear - 2, baseYear - 1, baseYear, baseYear + 1];
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const periodLabel = day ? `${day} ${formatMonth(year, month, locale)}` : formatMonth(year, month, locale);
  // Picking a single day makes every "month" heading a lie — the numbers
  // below are that day's.
  const attendanceLabel = day ? t('admin.dayAttendance') : t('admin.monthAttendance');

  const { data: total = 0 } = useQuery({ queryKey: qk.membersCount, queryFn: countActiveMembers });
  const { data: branches = [] } = useQuery({ queryKey: qk.branchOptions, queryFn: listBranchOptions });
  const { data: groups = [] } = useQuery({ queryKey: qk.groupOptions, queryFn: listGroupOptions });
  const { data: shifts = [] } = useQuery({ queryKey: qk.shifts, queryFn: listShifts });
  // Departments belong to a branch — offer only the selected branch's ones.
  const { data: departments = [] } = useQuery({
    queryKey: [...qk.departmentOptions, branchId],
    queryFn: () => listDepartmentOptions(branchId),
  });
  // Clear the department when the branch changes (it may not belong to the new one).
  useEffect(() => setDepartmentId(''), [branchId]);

  const filter: StatsFilter = { year, month, today: date, day, branchId, groupId, shiftId, departmentId };
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: qk.monthStats(year, month, day, branchId, groupId, shiftId, departmentId),
    queryFn: () => getMonthStats(filter),
  });

  const present = stats?.present ?? 0;
  const late = stats?.late ?? 0;
  const absent = stats?.absent ?? 0;
  const pending = stats?.pending ?? 0;
  const settled = stats?.settled ?? 0;
  const attendedOpen = stats?.attendedOpen ?? 0;
  const openSlots = pending + attendedOpen;
  const basis = stats?.rateBasis ?? 'none';
  const pct = stats?.rate ?? 0;
  // A percentage is shown whenever something can be measured: the finished
  // slots normally, or — when this filtered view has none — how many of the
  // still-running shift have arrived so far. Only a view with neither shows a
  // dash, because then there is genuinely nothing to say.
  const pctLabel = basis === 'none' ? '—' : `${pct}%`;
  const rateNote =
    basis === 'settled'
      ? t('admin.rateBasis', { count: settled })
      : basis === 'open'
        ? t('admin.rateBasisOpen', { count: openSlots })
        : t('admin.rateNoBasis');
  const todayDay = date.slice(0, 7) === `${year}-${String(month).padStart(2, '0')}` ? Number(date.slice(8, 10)) : undefined;

  const perBranch = branches
    .map((h) => ({ label: h.name, value: stats?.perBranch.find((x) => x.branch_id === h.id)?.value ?? 0 }))
    .filter((x) => x.value > 0);
  const perGroup = groups
    .map((b) => ({ label: b.name, value: stats?.perGroup.find((x) => x.group_id === b.id)?.value ?? 0 }))
    .filter((x) => x.value > 0);
  const perShift = shifts
    .map((s) => ({ label: s.name, value: stats?.perShift.find((x) => x.shift_id === s.id)?.value ?? 0 }))
    .filter((x) => x.value > 0);

  // Stacked bar: each branch split by present / late / absent.
  const stackedRows = branches
    .map((h) => {
      const s = stats?.perBranchStatus.find((x) => x.branch_id === h.id);
      return { name: h.name, present: s?.present ?? 0, late: s?.late ?? 0, absent: s?.absent ?? 0 };
    })
    .filter((h) => h.present + h.late + h.absent > 0)
    .map((h) => ({
      label: h.name,
      segments: [
        { value: h.present, color: STATUS_COLOR.present.solid, label: t('attendance.present') },
        { value: h.late, color: STATUS_COLOR.late.solid, label: t('attendance.late') },
        { value: h.absent, color: STATUS_COLOR.absent.solid, label: t('attendance.absent') },
      ],
    }));

  // Heat-map calendar layout (Sun-first, localized weekday initials).
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(Date.UTC(2023, 0, 1 + i))),
  );

  // The SERVER builds this file now, from the same scoped stats the screen is
  // reading. The page used to assemble it here — rows, totals and a spreadsheet
  // writer — which is why the client shipped an xlsx library for one button.
  //
  // The charts do not travel. A chart is a canvas, and a picture of one exists
  // only in the browser that drew it; every number behind every chart is in the
  // table the server produces.
  const exportDashboard = () => {
    serverExport(
      '/attendance/dashboard/export',
      {
        year,
        month,
        day,
        branchId: branchId || undefined,
        groupId: groupId || undefined,
        shiftId: shiftId || undefined,
        departmentId: departmentId || undefined,
      },
      `dashboard_${year}_${String(month).padStart(2, '0')}${day ? `_${day}` : ''}`,
    );
  };

  return (
    <IonPage>
      <AdminHeader title={t('nav.dashboard')}>
        {canOp('export') && (
          <IonButton onClick={exportDashboard} title={t('common.printReport')}>
            <IonIcon slot="icon-only" icon={downloadOutline} />
          </IonButton>
        )}
        <ThemeToggle />
        <LanguageToggle />
      </AdminHeader>
      <IonContent>
        <BrandHeader />
        <ServerClock />

        {/* Filters: period + branch + group + shift. */}
        <div className="ui-surface ui-section" style={{ overflow: 'hidden' }}>
          <div className="grid-filter-row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <IonItem lines="none">
              <IonSelect label={t('rosters.month')} interface="popover" value={month} onIonChange={(e) => setMonth(Number(e.detail.value))}>
                {MONTHS.map((m) => (
                  <IonSelectOption key={m} value={m}>{m}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem lines="none">
              <IonSelect label={t('rosters.year')} interface="popover" value={year} onIonChange={(e) => setYear(Number(e.detail.value))}>
                {years.map((y) => (
                  <IonSelectOption key={y} value={y}>{y}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem lines="none">
              <IonSelect label={t('rosters.day')} interface="popover" value={day ?? 0} onIonChange={(e) => setDay(Number(e.detail.value) || null)}>
                <IonSelectOption value={0}>{t('admin.allDays')}</IonSelectOption>
                {dayList.map((d) => (
                  <IonSelectOption key={d} value={d}>{d}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem lines="none">
              <IonSelect label={t('nav.branches')} interface="popover" value={branchId} onIonChange={(e) => setBranchId(String(e.detail.value))}>
                <IonSelectOption value="">{t('admin.allBranches')}</IonSelectOption>
                {branches.map((h) => (
                  <IonSelectOption key={h.id} value={h.id}>{h.name}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem lines="none">
              <IonSelect label={t('nav.groups')} interface="popover" value={groupId} onIonChange={(e) => setGroupId(String(e.detail.value))}>
                <IonSelectOption value="">{t('admin.allGroups')}</IonSelectOption>
                {groups.map((b) => (
                  <IonSelectOption key={b.id} value={b.id}>{b.name}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem lines="none">
              <IonSelect label={t('nav.shifts')} interface="popover" value={shiftId} onIonChange={(e) => setShiftId(String(e.detail.value))}>
                <IonSelectOption value="">{t('admin.allShifts')}</IonSelectOption>
                {shifts.map((s) => (
                  <IonSelectOption key={s.id} value={s.id}>{s.name}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem lines="none">
              <IonSelect label={t('nav.departments')} interface="popover" value={departmentId} onIonChange={(e) => setDepartmentId(String(e.detail.value))}>
                <IonSelectOption value="">{t('admin.allDepartments')}</IonSelectOption>
                {departments.map((d) => (
                  <IonSelectOption key={d.id} value={d.id}>{d.name}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </div>
          {/* Pick which chart panels to show (several at once). */}
          <IonItem lines="none">
            <IonSelect
              label={t('admin.charts')}
              interface="popover"
              multiple
              value={charts}
              onIonChange={(e) => setCharts(e.detail.value as ChartKey[])}
            >
              <IonSelectOption value="donut">{t('admin.chartDonut')}</IonSelectOption>
              <IonSelectOption value="gauge">{t('admin.chartGauge')}</IonSelectOption>
              <IonSelectOption value="statusPie">{t('admin.chartStatusPie')}</IonSelectOption>
              <IonSelectOption value="trendBar">{t('admin.chartTrendBar')}</IonSelectOption>
              <IonSelectOption value="trendLine">{t('admin.chartTrendLine')}</IonSelectOption>
              <IonSelectOption value="heatmap">{t('admin.chartHeatmap')}</IonSelectOption>
              <IonSelectOption value="stacked">{t('admin.chartStacked')}</IonSelectOption>
              <IonSelectOption value="radar">{t('admin.chartRadar')}</IonSelectOption>
              <IonSelectOption value="polar">{t('admin.chartPolar')}</IonSelectOption>
              <IonSelectOption value="bubble">{t('admin.chartBubble')}</IonSelectOption>
              <IonSelectOption value="scatter">{t('admin.chartScatter')}</IonSelectOption>
              <IonSelectOption value="branch">{t('admin.byBranch')}</IonSelectOption>
              <IonSelectOption value="group">{t('admin.byGroup')}</IonSelectOption>
              <IonSelectOption value="shift">{t('admin.byShift')}</IonSelectOption>
            </IonSelect>
          </IonItem>
        </div>

        {statsLoading && <DashboardSkeleton />}

        {/* Headline donut (optional). */}
        {!statsLoading && showChart('donut') && (
          <div className="ui-section" style={{ textAlign: 'center' }} data-chart-label={attendanceLabel}>
            <span className="ui-caption">{periodLabel}</span>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
              <DonutStat
                segments={[
                  { value: present, color: STATUS_COLOR.present.solid },
                  { value: late, color: STATUS_COLOR.late.solid },
                  { value: absent, color: STATUS_COLOR.absent.solid },
                  { value: pending, color: STATUS_COLOR.pending.solid },
                ]}
                centerTop={pctLabel}
                centerBottom={attendanceLabel}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Legend color={STATUS_COLOR.present.solid} label={t('attendance.present')} value={present} />
              <Legend color={STATUS_COLOR.late.solid} label={t('attendance.late')} value={late} />
              <Legend color={STATUS_COLOR.absent.solid} label={t('attendance.absent')} value={absent} />
              <Legend color={STATUS_COLOR.pending.solid} label={t('admin.stillOpen')} value={pending} />
            </div>
          </div>
        )}

        {/* Rate gauge (optional). */}
        {!statsLoading && showChart('gauge') && (
          <>
            <SectionHeader title={t('admin.attendanceRate')} />
            <div className="ui-surface ui-section" style={{ padding: 14 }} data-chart-label={t('admin.attendanceRate')}>
              <GaugeChart value={pct} label={t('admin.attendanceRate')} />
              <div className="ui-caption" style={{ textAlign: 'center' }}>{rateNote}</div>
            </div>
          </>
        )}

        {/* Status pie (optional). */}
        {!statsLoading && showChart('statusPie') && (
          <>
            <SectionHeader title={attendanceLabel} />
            <div className="ui-surface ui-section" style={{ padding: 14 }} data-chart-label={attendanceLabel}>
              <PieChart
                slices={[
                  { label: t('attendance.present'), value: present, color: STATUS_COLOR.present.solid },
                  { label: t('attendance.late'), value: late, color: STATUS_COLOR.late.solid },
                  { label: t('attendance.absent'), value: absent, color: STATUS_COLOR.absent.solid },
                  { label: t('admin.stillOpen'), value: pending, color: STATUS_COLOR.pending.solid },
                ]}
              />
            </div>
          </>
        )}

        {!statsLoading && (
        <div className="ui-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatTile icon={checkmarkCircleOutline} value={present} label={t('attendance.present')} color={STATUS_COLOR.present.solid} />
          <StatTile icon={timeOutline} value={late} label={t('attendance.late')} color={STATUS_COLOR.late.solid} />
          <StatTile icon={closeCircleOutline} value={absent} label={t('attendance.absent')} color={STATUS_COLOR.absent.solid} />
          <StatTile icon={hourglassOutline} value={pending} label={t('admin.stillOpen')} color={STATUS_COLOR.pending.solid} />
          <StatTile icon={statsChartOutline} value={pctLabel} label={t('admin.attendanceRate')} color={STATUS_COLOR.pending.solid} />
        </div>
        )}
        {!statsLoading && (
          <div className="ui-caption" style={{ textAlign: 'center', paddingBottom: 6 }}>{rateNote}</div>
        )}

        {/* Daily attendance-rate trend as COLUMNS and/or as a LINE/AREA (each is a
            separately selectable chart; both hidden when a single day is picked). */}
        {!day && showChart('trendBar') && (stats?.perDay?.length ?? 0) > 0 && (
          <>
            <SectionHeader title={`${t('admin.dailyTrend')} · ${t('admin.chartBar')}`} />
            <div className="ui-surface ui-section" style={{ padding: 14 }} data-chart-label={`${t('admin.dailyTrend')} · ${t('admin.chartBar')}`}>
              <TrendChart data={stats!.perDay} todayDay={todayDay} label={t('admin.dailyTrend')} type="bar" />
            </div>
          </>
        )}
        {!day && showChart('trendLine') && (stats?.perDay?.length ?? 0) > 0 && (
          <>
            <SectionHeader title={`${t('admin.dailyTrend')} · ${t('admin.chartLine')}`} />
            <div className="ui-surface ui-section" style={{ padding: 14 }} data-chart-label={`${t('admin.dailyTrend')} · ${t('admin.chartLine')}`}>
              <TrendChart data={stats!.perDay} todayDay={todayDay} label={t('admin.dailyTrend')} type="area" />
            </div>
          </>
        )}

        {/* Month heat-map calendar (optional; hidden for a single day). */}
        {!day && showChart('heatmap') && (stats?.perDay?.length ?? 0) > 0 && (
          <>
            <SectionHeader title={`${t('admin.dailyTrend')} · ${t('admin.chartHeatmap')}`} />
            <div className="ui-surface ui-section" style={{ padding: 14 }} data-chart-label={`${t('admin.dailyTrend')} · ${t('admin.chartHeatmap')}`}>
              <HeatmapChart data={stats!.perDay} firstWeekday={firstWeekday} weekdays={weekdays} todayDay={todayDay} />
            </div>
          </>
        )}

        {/* Stacked branches × status (optional). */}
        {!statsLoading && showChart('stacked') && stackedRows.length > 0 && (
          <>
            <SectionHeader title={t('admin.chartStacked')} />
            <div className="ui-surface ui-section" style={{ padding: 14 }} data-chart-label={t('admin.chartStacked')}>
              <StackedBar
                rows={stackedRows}
                legend={[
                  { label: t('attendance.present'), color: STATUS_COLOR.present.solid },
                  { label: t('attendance.late'), color: STATUS_COLOR.late.solid },
                  { label: t('attendance.absent'), color: STATUS_COLOR.absent.solid },
                ]}
              />
            </div>
          </>
        )}

        {/* Radar — attendance across branches (each branch is an axis). */}
        {!statsLoading && showChart('radar') && perBranch.length >= 3 && (
          <>
            <SectionHeader title={t('admin.chartRadar')} />
            <div className="ui-surface ui-section" style={{ padding: 14 }} data-chart-label={t('admin.chartRadar')}>
              <RadarChart items={perBranch} />
            </div>
          </>
        )}

        {/* Polar area — present / late / absent by area. */}
        {!statsLoading && showChart('polar') && (present + late + absent) > 0 && (
          <>
            <SectionHeader title={t('admin.chartPolar')} />
            <div className="ui-surface ui-section" style={{ padding: 14 }} data-chart-label={t('admin.chartPolar')}>
              <PolarAreaChart
                slices={[
                  { label: t('attendance.present'), value: present, color: STATUS_COLOR.present.solid },
                  { label: t('attendance.late'), value: late, color: STATUS_COLOR.late.solid },
                  { label: t('attendance.absent'), value: absent, color: STATUS_COLOR.absent.solid },
                ]}
              />
            </div>
          </>
        )}

        {/* Bubble — day (x) × rate (y), sized by that day's headcount. */}
        {!day && showChart('bubble') && (stats?.perDay?.length ?? 0) > 0 && (
          <>
            <SectionHeader title={`${t('admin.dailyTrend')} · ${t('admin.chartBubble')}`} />
            <div className="ui-surface ui-section" style={{ padding: 14 }} data-chart-label={t('admin.chartBubble')}>
              <ScatterBubbleChart
                xMax={stats!.perDay.length}
                points={stats!.perDay
                  .filter((d) => d.attended + d.absent > 0)
                  .map((d) => ({ x: d.day, y: d.rate, r: d.attended + d.absent }))}
              />
            </div>
          </>
        )}

        {/* Scatter — day (x) × rate (y). */}
        {!day && showChart('scatter') && (stats?.perDay?.length ?? 0) > 0 && (
          <>
            <SectionHeader title={`${t('admin.dailyTrend')} · ${t('admin.chartScatter')}`} />
            <div className="ui-surface ui-section" style={{ padding: 14 }} data-chart-label={t('admin.chartScatter')}>
              <ScatterBubbleChart
                xMax={stats!.perDay.length}
                points={stats!.perDay
                  .filter((d) => d.attended + d.absent > 0)
                  .map((d) => ({ x: d.day, y: d.rate }))}
              />
            </div>
          </>
        )}

        {!statsLoading && showChart('branch') && perBranch.length > 0 && (
          <>
            <SectionHeader title={t('admin.byBranch')} />
            <div className="ui-surface ui-section" style={{ padding: 14 }} data-chart-label={t('admin.byBranch')}>
              <ColumnChart items={perBranch} color="#0d9488" />
            </div>
          </>
        )}

        {!statsLoading && showChart('group') && perGroup.length > 0 && (
          <>
            <SectionHeader title={t('admin.byGroup')} />
            <div className="ui-surface ui-section" style={{ padding: 14 }} data-chart-label={t('admin.byGroup')}>
              <ColumnChart items={perGroup} color="#6366f1" />
            </div>
          </>
        )}

        {!statsLoading && showChart('shift') && perShift.length > 0 && (
          <>
            <SectionHeader title={t('admin.byShift')} />
            <div className="ui-surface ui-section" style={{ padding: 14 }} data-chart-label={t('admin.byShift')}>
              <ColumnChart items={perShift} color="#0891b2" />
            </div>
          </>
        )}

        {/* Catalog totals. */}
        <div className="ui-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatTile icon={peopleOutline} value={total} label={t('admin.totalMembers')} />
          <StatTile icon={businessOutline} value={branches.length} label={t('nav.branches')} />
          <StatTile icon={calendarOutline} value={groups.length} label={t('nav.groups')} />
          <StatTile icon={timeOutline} value={shifts.length} label={t('nav.shifts')} />
        </div>

        <Copyright />
      </IonContent>
    </IonPage>
  );
}
