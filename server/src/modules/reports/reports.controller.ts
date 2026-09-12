import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AnyStaff, Page } from '../../common/decorators/page.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { badRequest } from '../../common/errors.js';
import { ReportsService } from './reports.service.js';
import { ApiResponse, PaginatedResponse } from '../../common/dto/api-response.dto.js';
import {
  GetPresentQueryDto,
  GetReviewQueryDto,
  GetDetailQueryDto,
  GetHistoryQueryDto,
  GetDayQueryDto,
  GetDailyRosterQueryDto,
  GetMonthlyQueryDto,
  GetReportQueryDto,
  GetTodayQueryDto,
  GetStatsQueryDto,
  GetProbesDto,
  PresentMemberRowDto,
  ReviewAttendanceItemDto,
  DetailAttendanceItemDto,
  AttendanceHistoryEntryDto,
  DayAttendanceResultDto,
  GetDashboardExportQueryDto,
  GetHistoryExportQueryDto,
  ReportRowDto,
  DailyRosterItemDto,
  TodaySummaryDto,
  StatsSummaryDto,
  ProbeItemDto,
  MonthlyAttendanceRowDto,
} from './dto/reports.dto.js';
import { Role } from '../../common/enums/index.js';
import { Lang } from '../../common/decorators/lang.decorator.js';
import type { SupportedLanguage } from '../../common/i18n/i18n.types.js';
import { I18nService } from '../../common/i18n/i18n.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { parseFormat, sendReport } from '../../infrastructure/export/render.js';
import { legendRows } from '../../infrastructure/export/legend.js';
import type { ReportDocument } from '../../infrastructure/export/export.types.js';
import { dashboardCharts, parsePanels } from '../../domain/report/dashboardCharts.js';
import { ATTENDANCE_OUTCOME, OUTCOME_LEGEND_ORDER } from '../../config/constants.js';
import { cairoClock } from '../../domain/clock.js';
import {
  daysInMonth,
  monthRate,
  representativeStatus,
  statusFill,
  statusMark,
  type DailyStatus,
} from '../../domain/report/matrix.js';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('api/v1/attendance')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly i18n: I18nService,
    private readonly catalog: CatalogService,
  ) {}

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('presence')
  @Get('present')
  @ApiOperation({ summary: 'Get currently present members for given dates' })
  @SwaggerResponse({ status: 200, type: ApiResponse<PresentMemberRowDto[]> })
  async getPresent(
    @CallerDecorator() caller: Caller,
    @Query() query: GetPresentQueryDto,
  ): Promise<ApiResponse<PresentMemberRowDto[]>> {
    if (!query?.dates) throw badRequest('invalid_query', 'dates is required');
    const dates = query.dates.split(',').map((d) => d.trim()).filter(Boolean);

    const data = await this.reportsService.getPresent(caller, dates);
    return new ApiResponse(data as PresentMemberRowDto[]);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('review')
  @Get('review')
  @ApiOperation({ summary: 'Get daily review attendance data for branch/date' })
  @SwaggerResponse({ status: 200, type: ApiResponse<ReviewAttendanceItemDto[]> })
  async getReview(
    @CallerDecorator() caller: Caller,
    @Query() query: GetReviewQueryDto,
  ): Promise<ApiResponse<ReviewAttendanceItemDto[]>> {
    if (!query?.date) throw badRequest('invalid_query', 'date is required');

    const data = await this.reportsService.getReview(caller, query.date, query.branch_id);
    return new ApiResponse(data as ReviewAttendanceItemDto[]);
  }

  @Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN)
  @Page('review')
  @Get('detail')
  @ApiOperation({ summary: 'Get detailed attendance record for member/date' })
  @SwaggerResponse({ status: 200, type: ApiResponse<DetailAttendanceItemDto | null> })
  async getDetail(
    @CallerDecorator() caller: Caller,
    @Query() query: GetDetailQueryDto,
  ): Promise<ApiResponse<DetailAttendanceItemDto | null>> {
    if (!query?.member_id || !query?.date) throw badRequest('invalid_query', 'member_id and date are required');

    const data = await this.reportsService.getDetail(caller, query.member_id, query.date, query.shift_id);
    return new ApiResponse(data as DetailAttendanceItemDto | null);
  }

  @Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN)
  @AnyStaff()
  @Get('history')
  @ApiOperation({ summary: 'Get monthly attendance history for a member' })
  @SwaggerResponse({ status: 200, type: ApiResponse<AttendanceHistoryEntryDto[]> })
  async getHistory(
    @CallerDecorator() caller: Caller,
    @Query() query: GetHistoryQueryDto,
  ): Promise<ApiResponse<AttendanceHistoryEntryDto[]>> {
    if (!query?.member_id) throw badRequest('invalid_query', 'member_id is required');

    const data = await this.reportsService.getHistory(caller, query.member_id, query.year, query.month);
    return new ApiResponse(data as AttendanceHistoryEntryDto[]);
  }

  /**
   * A member's own month as a file.
   *
   * The screen used to build this itself — rows, legend, colours and all — which
   * meant the same report existed twice, once here for the admin grids and once
   * in the browser for this one. They drifted: a mark added to
   * ATTENDANCE_OUTCOME reached the admin exports and not this one.
   *
   * The scope check is getHistory's. A member may export THEMSELVES; staff go
   * through their assignments, exactly as the screen behind it does.
   */
  @Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN)
  @AnyStaff()
  @Get('history/export')
  @ApiOperation({ summary: "Export a member's monthly attendance history" })
  async exportHistory(
    @CallerDecorator() caller: Caller,
    @Query() query: GetHistoryExportQueryDto,
    @Lang() lang: SupportedLanguage,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!query?.member_id) throw badRequest('invalid_query', 'member_id is required');

    const entries = await this.reportsService.getHistory(
      caller,
      query.member_id,
      query.year,
      query.month,
    );
    const t = (key: string) => this.i18n.translate(`report.${key}`, lang);

    const headers = [t('date'), t('shift'), t('check_in'), t('check_out'), t('status')];
    const rows: (string | number)[][] = [];
    const cellColors: (string | undefined)[][] = [];

    for (const e of entries) {
      const style = ATTENDANCE_OUTCOME[e.outcome];
      rows.push([
        e.date,
        e.shift_name ?? '',
        cairoClock(e.check_in_at),
        cairoClock(e.check_out_at),
        `${style.mark}  ${this.i18n.translate(style.labelKey, lang)}`,
      ]);
      // Only the status cell carries the colour; a whole coloured row reads as
      // data rather than as a verdict about the day.
      cellColors.push([undefined, undefined, undefined, undefined, style.fill]);
    }

    // The month in one line, counted over the same vocabulary the rows use, so
    // the summary cannot disagree with what is above it.
    const tally = OUTCOME_LEGEND_ORDER.filter((k) => entries.some((e) => e.outcome === k))
      .map((k) => `${this.i18n.translate(ATTENDANCE_OUTCOME[k].labelKey, lang)}: ${
        entries.filter((e) => e.outcome === k).length
      }`)
      .join('  \u00b7  ');
    rows.push([t('total'), String(entries.length), '', '', tally]);
    cellColors.push([]);

    const legend = legendRows(t, headers.length);
    rows.push(...legend.rows);
    cellColors.push(...legend.colors);

    const pad = (n: number) => String(n).padStart(2, '0');
    const period = query.year && query.month ? `${query.year}-${pad(query.month)}` : 'all';
    const doc = {
      title: `${t('my_attendance')} ${period}`,
      rtl: lang === 'ar',
      generatedAt: `${t('generated_at')}: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      headers,
      rows,
      cellColors,
    };

    await sendReport(reply, parseFormat(query.format), doc, `my-attendance-${period}`);
  }

  @Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN)
  @AnyStaff()
  @Get('day')
  @ApiOperation({ summary: 'Get member attendance status for a single day' })
  @SwaggerResponse({ status: 200, type: ApiResponse<DayAttendanceResultDto> })
  async getDay(
    @CallerDecorator() caller: Caller,
    @Query() query: GetDayQueryDto,
  ): Promise<ApiResponse<DayAttendanceResultDto>> {
    if (!query?.member_id || !query?.date) throw badRequest('invalid_query', 'member_id and date are required');

    const data = await this.reportsService.getDay(caller, query.member_id, query.date);
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('rosters')
  @Get('daily-roster')
  @ApiOperation({ summary: 'Get scheduled members roster for a given day' })
  @SwaggerResponse({ status: 200, type: ApiResponse<DailyRosterItemDto[]> })
  async getDailyRoster(
    @CallerDecorator() caller: Caller,
    @Query() query: GetDailyRosterQueryDto,
  ): Promise<ApiResponse<DailyRosterItemDto[]>> {
    if (!query?.date) throw badRequest('invalid_query', 'date is required');

    const data = await this.reportsService.getDailyRoster(caller, query.date, query.branch_id);
    return new ApiResponse(data as DailyRosterItemDto[]);
  }

  /**
   * The monthly attendance matrix as .xlsx — every member the filter matches.
   *
   * Takes the same query as `GET /monthly` minus the paging. The cell colours
   * and the worst-of-the-day rule come from domain/report/matrix.ts, the same
   * module the screen renders from, so the file and the grid cannot disagree
   * about what a mixed day means.
   */
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('review', 'export')
  @Get('monthly/export')
  @ApiOperation({ summary: 'Export the monthly attendance matrix as .xlsx (Admin only)' })
  async exportMonthly(
    @CallerDecorator() caller: Caller,
    @Query() query: GetMonthlyQueryDto,
    @Lang() lang: SupportedLanguage,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { page: _page, page_size: _pageSize, year, month, ...filters } = query;
    if (!year || !month) throw badRequest('invalid_query', 'year and month are required');

    const data = await this.reportsService.getMonthlyForExport(caller, filters, year, month);
    const t = (key: string) => this.i18n.translate(`report.${key}`, lang);

    const dayList = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);
    const rows: (string | number)[][] = [];
    const cellColors: (string | undefined)[][] = [];

    for (const r of data.rows as Array<{
      full_name: string;
      national_id: string;
      days: Record<string, DailyStatus[] | undefined>;
    }>) {
      const marks = dayList.map((d) => statusMark(representativeStatus(r.days[String(d)] ?? [])));
      const { attended, rostered } = monthRate(r.days);

      rows.push([r.full_name ?? '', r.national_id ?? '', ...marks, `${attended}/${rostered}`]);
      cellColors.push([
        undefined,
        undefined,
        ...dayList.map((d) => statusFill(representativeStatus(r.days[String(d)] ?? []))),
        undefined,
      ]);
    }

    // The key to the marks, under the table. An exported file outlives the
    // screen it came from — somebody opens it months later with nothing beside
    // it to explain what a mark meant.
    const headers = [t('full_name'), t('national_id'), ...dayList.map(String), t('total')];
    const legend = legendRows(t, headers.length);
    rows.push(...legend.rows);
    cellColors.push(...legend.colors);

    const pad = (n: number) => String(n).padStart(2, '0');
    const doc = {
      title: `${t('attendance')} ${pad(month)}-${year}`,
      rtl: lang === 'ar',
      // A column per day does not fit portrait.
      landscape: true,
      generatedAt: `${t('generated_at')}: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      headers,
      rows,
      cellColors,
    };

    await sendReport(reply, parseFormat(query.format), doc, `attendance-${year}-${pad(month)}`);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('review')
  @Get('monthly')
  @ApiOperation({ summary: 'Get monthly attendance grid with pagination' })
  @SwaggerResponse({ status: 200, type: PaginatedResponse<MonthlyAttendanceRowDto> })
  async getMonthly(
    @CallerDecorator() caller: Caller,
    @Query() query: GetMonthlyQueryDto,
  ): Promise<PaginatedResponse<MonthlyAttendanceRowDto>> {
    const { page = 1, page_size: pageSize = 50, year, month, ...filters } = query;
    if (!year || !month) throw badRequest('invalid_query', 'year and month are required');

    const data = await this.reportsService.getMonthly(caller, filters, year, month, page, pageSize);
    return new PaginatedResponse(data.rows, data.total, { page, pageSize });
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('review')
  @Get('report')
  @ApiOperation({ summary: 'Generate attendance report across date range' })
  @SwaggerResponse({ status: 200, type: ApiResponse<ReportRowDto[]> })
  async getReport(
    @CallerDecorator() caller: Caller,
    @Query() query: GetReportQueryDto,
  ): Promise<ApiResponse<ReportRowDto[]>> {
    if (!query?.from || !query?.to) throw badRequest('invalid_query', 'from and to are required');

    const data = await this.reportsService.getReport(caller, query.from, query.to, query.branch_id, query.group_id);
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('dashboard')
  @Get('today')
  @ApiOperation({ summary: 'Get today summary of attendance' })
  @SwaggerResponse({ status: 200, type: ApiResponse<TodaySummaryDto[]> })
  async getToday(
    @CallerDecorator() caller: Caller,
    @Query() query: GetTodayQueryDto,
  ): Promise<ApiResponse<TodaySummaryDto[]>> {
    if (!query?.date) throw badRequest('invalid_query', 'date is required');

    const data = await this.reportsService.getToday(caller, query.date);
    return new ApiResponse(data);
  }

  /**
   * The dashboard as a file: the same numbers the screen is showing.
   *
   * Every figure here comes from getStats, which is scoped to the caller, so an
   * assigned admin exports their own reach and nothing else. The catalog is read
   * through CatalogService for the same reason — its option lists take a caller
   * and are already narrowed.
   *
   * THE CHARTS TRAVEL. The screen sends the panels it is showing (`charts=`),
   * and the same scoped stats are drawn again here — as SVG in the print
   * document, as cell-drawn bars in the workbook — so the file holds what the
   * reader was looking at, not a screenshot of it. See domain/report/
   * dashboardCharts.ts for how each panel maps onto a printable form.
   *
   * This used to be assembled in the page, which is why the export and the
   * admin grids disagreed about formatting and why the client carried a
   * spreadsheet writer of its own.
   */
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('dashboard', 'export')
  @Get('dashboard/export')
  @ApiOperation({ summary: 'Export the dashboard summary (Admin only)' })
  async exportDashboard(
    @CallerDecorator() caller: Caller,
    @Query() query: GetDashboardExportQueryDto,
    @Lang() lang: SupportedLanguage,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!query?.year || !query?.month) throw badRequest('invalid_query', 'year and month are required');

    const [stats, branches, groups, shifts] = await Promise.all([
      this.reportsService.getStats(caller, query.year, query.month, query),
      this.catalog.getBranchesOptions(caller),
      this.catalog.getGroupsOptions(caller),
      this.catalog.getShifts(),
    ]);

    const t = (key: string) => this.i18n.translate(`report.${key}`, lang);
    const nameOf = (list: { id: string; name: string }[], id: string | null | undefined) =>
      (id ? list.find((x) => x.id === id)?.name : undefined) ?? t('all');

    const pad = (n: number) => String(n).padStart(2, '0');
    const period = `${query.year}-${pad(query.month)}${query.day ? `-${pad(query.day)}` : ''}`;

    const rows: (string | number)[][] = [];
    /** A blank line, then a heading — the sheet's only structure. */
    const section = (label: string) => {
      rows.push(['', '']);
      rows.push([label, '']);
    };

    rows.push([t('period'), period]);
    rows.push([t('branch'), nameOf(branches, query.branchId)]);
    rows.push([t('group'), nameOf(groups, query.groupId)]);
    rows.push([t('shift'), nameOf(shifts, query.shiftId)]);

    section(t('overview'));
    rows.push([t('present'), stats.present]);
    rows.push([t('late'), stats.late]);
    rows.push([t('absent'), stats.absent]);
    rows.push([t('still_open'), stats.pending]);
    rows.push([t('attended'), stats.attended]);
    // The basis travels with the rate: "78%" over four finished slots and over
    // four hundred are different claims, and a file outlives the screen that
    // would have said which.
    rows.push([t('rate'), stats.rateBasis === 'none' ? '—' : `${stats.rate}%`]);
    rows.push([t('rate_basis'), stats.rateBasis]);

    section(t('totals'));
    rows.push([t('branches'), branches.length]);
    rows.push([t('groups'), groups.length]);
    rows.push([t('shifts'), shifts.length]);

    /** A breakdown, skipped when every row of it would be zero. */
    const breakdown = <T extends { value: number }>(
      label: string,
      list: { id: string; name: string }[],
      values: T[],
      idOf: (value: T) => string,
    ) => {
      const named = list
        .map((item) => ({
          label: item.name,
          value: values.find((v) => idOf(v) === item.id)?.value ?? 0,
        }))
        // Only what the caller can actually see. The values come from getStats,
        // which is scoped, so a branch outside the caller's assignments scores
        // zero here and drops out — the catalog is a name lookup, not a list of
        // what they may know about.
        .filter((x) => x.value > 0);
      if (!named.length) return;
      section(label);
      for (const n of named) rows.push([n.label, n.value]);
    };

    breakdown(t('by_branch'), branches, stats.perBranch, (v) => v.branch_id);
    breakdown(t('by_group'), groups, stats.perGroup, (v) => v.group_id);
    breakdown(t('by_shift'), shifts, stats.perShift, (v) => v.shift_id);

    const activeDays = stats.perDay.filter((d) => d.attended + d.absent + d.pending > 0);
    if (activeDays.length) {
      section(t('daily_trend'));
      for (const d of activeDays) {
        rows.push([
          String(d.day),
          d.settled > 0
            ? `${d.rate}% · ${d.settled - d.absent}/${d.settled}${d.pending ? ` (+${d.pending})` : ''}`
            : `— · ${d.pending}`,
        ]);
      }
    }

    // Seven short weekday names, Sunday first, for the calendar heat-map.
    const weekdayNames = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en', { weekday: 'narrow' });
    const weekdays = Array.from({ length: 7 }, (_, i) => weekdayNames.format(new Date(Date.UTC(2023, 0, 1 + i))));

    const charts = dashboardCharts(parsePanels(query.charts), {
      stats,
      branches,
      groups,
      shifts,
      year: query.year,
      month: query.month,
      weekdays,
      t,
    });

    const doc: ReportDocument = {
      title: `${t('dashboard')} ${period}`,
      rtl: lang === 'ar',
      generatedAt: `${t('generated_at')}: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      headers: [t('metric'), t('value')],
      rows,
      charts,
    };

    await sendReport(reply, parseFormat(query.format), doc, `dashboard-${period}`);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('dashboard')
  @Get('stats')
  @ApiOperation({ summary: 'Get attendance statistical metrics' })
  @SwaggerResponse({ status: 200, type: ApiResponse<StatsSummaryDto> })
  async getStats(
    @CallerDecorator() caller: Caller,
    @Query() query: GetStatsQueryDto,
  ): Promise<ApiResponse<StatsSummaryDto>> {
    if (!query?.year || !query?.month) throw badRequest('invalid_query', 'year and month are required');

    const data = await this.reportsService.getStats(caller, query.year, query.month, query);
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @Page('faceImages')
  @Post('probes')
  @ApiOperation({ summary: 'Get attendance face verification probes for members' })
  @SwaggerResponse({ status: 200, type: ApiResponse<ProbeItemDto[]> })
  async getProbes(
    @Body() body: GetProbesDto,
  ): Promise<ApiResponse<ProbeItemDto[]>> {
    if (!body?.member_ids?.length) return new ApiResponse([]);

    const data = await this.reportsService.getProbes(body.member_ids, body.from, body.to);
    return new ApiResponse(data as ProbeItemDto[]);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('faceImages')
  @Get('probe-paths')
  @ApiOperation({ summary: 'Get list of all probe paths (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<string[]> })
  async getProbePaths(): Promise<ApiResponse<string[]>> {
    const data = await this.reportsService.getProbePaths();
    return new ApiResponse(data);
  }
}
