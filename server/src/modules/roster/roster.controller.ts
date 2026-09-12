import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AnyStaff, Page } from '../../common/decorators/page.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { badRequest } from '../../common/errors.js';
import { RosterService } from './roster.service.js';
import { ApiResponse, PaginatedResponse } from '../../common/dto/api-response.dto.js';
import {
  MonthQueryDto,
  RosterDayInputDto,
  GetRosterViewQueryDto,
  GetExistingKeysDto,
  PostRosterDaysDto,
  BulkRosterDto,
  BulkRosterResultDto,
  RosterMakerDataDto,
  RosterViewRowDto,
  RosterTotalsResponseDto,
} from './dto/roster.dto.js';
import { Role } from '../../common/enums/index.js';
import { Lang } from '../../common/decorators/lang.decorator.js';
import type { SupportedLanguage } from '../../common/i18n/i18n.types.js';
import { I18nService } from '../../common/i18n/i18n.service.js';
import { parseFormat, sendReport } from '../../infrastructure/export/render.js';
import { daysInMonth } from '../../domain/report/matrix.js';

@ApiTags('Roster')
@ApiBearerAuth()
@Controller('api/v1/roster')
export class RosterController {
  constructor(
    private readonly service: RosterService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * The monthly roster as .xlsx — every member the filter matches.
   *
   * A day cell lists the shift keys rostered that day; then one column per
   * shift counting that member's slots, and a grand total. The closing rows are
   * the same counts down the columns, which is what makes the sheet answer
   * "how many people are on the morning shift on the 12th?" without a formula.
   */
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('rosters', 'export')
  @Get('export')
  @ApiOperation({ summary: 'Export the monthly roster as .xlsx (Admin only)' })
  async exportRoster(
    @CallerDecorator() caller: Caller | null,
    @Query() query: GetRosterViewQueryDto,
    @Lang() lang: SupportedLanguage,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { page: _page, page_size: _pageSize, year, month, ...filters } = query;
    if (!year || !month) throw badRequest('invalid_query', 'year and month are required');

    const { rows, shifts, departments } = await this.service.getRosterForExport(
      caller!,
      filters,
      year,
      month,
    );
    const t = (key: string) => this.i18n.translate(`report.${key}`, lang);
    const dayList = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);

    /** That member's cells for one day. */
    const cells = (r: (typeof rows)[number], day: number) => r.days[String(day)] ?? [];

    const body: (string | number)[][] = rows.map((r) => [
      r.full_name,
      departments.get(r.member_id) ?? '',
      ...dayList.map((d) => cells(r, d).map((c) => c.label).join(' ')),
      ...shifts.map((sh) =>
        String(dayList.reduce((sum, d) => sum + cells(r, d).filter((c) => c.shift_id === sh.id).length, 0)),
      ),
      String(dayList.reduce((sum, d) => sum + cells(r, d).length, 0)),
    ]);

    // One closing row per shift, then the all-shifts row.
    const totals: (string | number)[][] = shifts.map((sh) => {
      const perDay = dayList.map((d) =>
        rows.reduce((sum, r) => sum + cells(r, d).filter((c) => c.shift_id === sh.id).length, 0),
      );
      return [
        sh.name,
        '',
        ...perDay.map(String),
        ...shifts.map((other) =>
          other.id === sh.id ? String(perDay.reduce((a, b) => a + b, 0)) : '',
        ),
        String(perDay.reduce((a, b) => a + b, 0)),
      ];
    });

    const perDayAll = dayList.map((d) => rows.reduce((sum, r) => sum + cells(r, d).length, 0));
    totals.push([
      t('total'),
      '',
      ...perDayAll.map(String),
      ...shifts.map(() => ''),
      String(perDayAll.reduce((a, b) => a + b, 0)),
    ]);

    const pad = (n: number) => String(n).padStart(2, '0');
    const doc = {
      title: `${t('roster')} ${pad(month)}-${year}`,
      rtl: lang === 'ar',
      landscape: true,
      generatedAt: `${t('generated_at')}: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      headers: [
        t('full_name'),
        t('department'),
        ...dayList.map(String),
        ...shifts.map((sh) => sh.key || sh.name),
        t('total'),
      ],
      rows: [...body, ...totals],
    };

    await sendReport(reply, parseFormat(query.format), doc, `roster-${year}-${pad(month)}`);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('rosters')
  @Get('view')
  @ApiOperation({ summary: 'Get monthly roster grid view with pagination (Admin only)' })
  @SwaggerResponse({ status: 200, type: PaginatedResponse<RosterViewRowDto> })
  async getRosterView(
    @CallerDecorator() caller: Caller | null,
    @Query() query: GetRosterViewQueryDto,
  ): Promise<PaginatedResponse<RosterViewRowDto>> {
    const { page = 1, page_size: pageSize = 50, year, month, ...filters } = query;
    if (!year || !month) throw badRequest('invalid_query', 'year and month are required');
    const offset = (page - 1) * pageSize;

    const data = await this.service.getRosterView(caller!, filters, year, month, pageSize, offset);
    return new PaginatedResponse(data.rows, data.total, { page, pageSize });
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('rosters')
  @Get('totals')
  @ApiOperation({ summary: 'Get monthly roster totals (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<RosterTotalsResponseDto> })
  async getRosterTotals(
    @CallerDecorator() caller: Caller | null,
    @Query() query: GetRosterViewQueryDto,
  ): Promise<ApiResponse<RosterTotalsResponseDto>> {
    const { year, month, ...filters } = query;
    if (!year || !month) throw badRequest('invalid_query', 'year and month are required');

    const data = await this.service.getRosterTotals(caller!, filters, year, month);
    return new ApiResponse(data);
  }

  @Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN)
  @AnyStaff()
  @Get('maker-data')
  @ApiOperation({ summary: 'Get roster maker options and metadata for given month' })
  @SwaggerResponse({ status: 200, type: ApiResponse<RosterMakerDataDto> })
  async getMakerData(
    @CallerDecorator() caller: Caller | null,
    @Query() query: MonthQueryDto,
  ): Promise<ApiResponse<RosterMakerDataDto>> {
    if (!query?.year || !query?.month) throw badRequest('invalid_query', 'year and month are required');

    const data = await this.service.getMakerData(caller!, query.year, query.month);
    return new ApiResponse(data as RosterMakerDataDto);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @Page('rosters')
  @Post('existing-keys')
  @ApiOperation({ summary: 'Query existing roster schedule keys for members (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<string[]> })
  async getExistingKeys(
    @CallerDecorator() caller: Caller | null,
    @Body() body: GetExistingKeysDto,
  ): Promise<ApiResponse<string[]>> {
    if (!body?.year || !body?.month || !body?.member_ids) {
      throw badRequest('invalid_body', 'year, month, and member_ids are required');
    }

    const data = await this.service.getExistingKeys(caller!, body.year, body.month, body.member_ids);
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @Page('rosters', 'edit')
  @Post('days')
  @ApiOperation({ summary: 'Assign one or more member roster shift days' })
  @SwaggerResponse({ status: 201, type: ApiResponse<{ ok: true }> })
  async postRosterDays(
    @CallerDecorator() caller: Caller | null,
    @Body() body: PostRosterDaysDto,
  ): Promise<ApiResponse<{ ok: true }>> {
    let days: RosterDayInputDto[] = [];
    if (body?.days && Array.isArray(body.days)) {
      days = body.days;
    } else if (body?.member_id && body?.date && body?.shift_id) {
      days = [{ member_id: body.member_id, date: body.date, shift_id: body.shift_id }];
    } else {
      throw badRequest('invalid_body', 'invalid roster payload');
    }

    await this.service.postRosterDays(caller!, days);
    return new ApiResponse({ ok: true });
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('rosters', 'edit')
  @Delete('days')
  @ApiOperation({ summary: 'Remove a member roster shift assignment' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteRosterDays(
    @CallerDecorator() caller: Caller | null,
    @Body() body: RosterDayInputDto,
  ): Promise<ApiResponse<{ ok: true }>> {
    if (!body?.member_id || !body?.date || !body?.shift_id) {
      throw badRequest('invalid_body', 'member_id, date, and shift_id are required');
    }

    await this.service.deleteRosterDays(caller!, body);
    return new ApiResponse({ ok: true });
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @Page('rosters', 'edit')
  @Post('bulk')
  @ApiOperation({ summary: 'Bulk schedule roster shifts across members' })
  @SwaggerResponse({ status: 201, type: ApiResponse<BulkRosterResultDto> })
  async bulkRoster(
    @CallerDecorator() caller: Caller | null,
    @Body() body: BulkRosterDto,
  ): Promise<ApiResponse<BulkRosterResultDto>> {
    if (!body?.year || !body?.month || !body?.shift_id || !body?.mode) {
      throw badRequest('invalid_body', 'invalid bulk payload');
    }

    const data = await this.service.bulkRoster(caller!, body);
    return new ApiResponse(data as BulkRosterResultDto);
  }
}
