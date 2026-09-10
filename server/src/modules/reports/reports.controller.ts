import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { JwtClaims } from '../../db/context.js';
import { badRequest } from '../../http/errors.js';
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
} from './dto/reports.dto.js';
import { Role } from '../../common/enums/index.js';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('api/v1/attendance')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('present')
  @ApiOperation({ summary: 'Get currently present members for given dates' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getPresent(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: GetPresentQueryDto,
  ): Promise<ApiResponse<unknown>> {
    if (!query?.dates) throw badRequest('invalid_query', 'dates is required');
    const dates = query.dates.split(',').map((d) => d.trim()).filter(Boolean);

    const data = await this.reportsService.getPresent(claims, dates);
    return new ApiResponse(data);
  }

  @Get('review')
  @ApiOperation({ summary: 'Get daily review attendance data for branch/date' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getReview(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: GetReviewQueryDto,
  ): Promise<ApiResponse<unknown>> {
    if (!query?.date) throw badRequest('invalid_query', 'date is required');

    const data = await this.reportsService.getReview(claims, query.date, query.branch_id);
    return new ApiResponse(data);
  }

  @Get('detail')
  @ApiOperation({ summary: 'Get detailed attendance record for member/date' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getDetail(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: GetDetailQueryDto,
  ): Promise<ApiResponse<unknown>> {
    if (!query?.member_id || !query?.date) throw badRequest('invalid_query', 'member_id and date are required');

    const data = await this.reportsService.getDetail(claims, query.member_id, query.date, query.shift_id);
    return new ApiResponse(data);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get monthly attendance history for a member' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getHistory(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: GetHistoryQueryDto,
  ): Promise<ApiResponse<unknown>> {
    if (!query?.member_id) throw badRequest('invalid_query', 'member_id is required');

    const data = await this.reportsService.getHistory(claims, query.member_id, query.year, query.month);
    return new ApiResponse(data);
  }

  @Get('day')
  @ApiOperation({ summary: 'Get member attendance status for a single day' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getDay(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: GetDayQueryDto,
  ): Promise<ApiResponse<unknown>> {
    if (!query?.member_id || !query?.date) throw badRequest('invalid_query', 'member_id and date are required');

    const data = await this.reportsService.getDay(claims, query.member_id, query.date);
    return new ApiResponse(data);
  }

  @Get('daily-roster')
  @ApiOperation({ summary: 'Get scheduled members roster for a given day' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getDailyRoster(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: GetDailyRosterQueryDto,
  ): Promise<ApiResponse<unknown>> {
    if (!query?.date) throw badRequest('invalid_query', 'date is required');

    const data = await this.reportsService.getDailyRoster(claims, query.date, query.branch_id);
    return new ApiResponse(data);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Get monthly attendance grid with pagination' })
  @SwaggerResponse({ status: 200, type: PaginatedResponse<unknown> })
  async getMonthly(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: GetMonthlyQueryDto,
  ): Promise<PaginatedResponse<unknown>> {
    const { page = 1, page_size: pageSize = 50, year, month, ...filters } = query;
    if (!year || !month) throw badRequest('invalid_query', 'year and month are required');

    const data = await this.reportsService.getMonthly(claims, filters, year, month, page, pageSize);
    return new PaginatedResponse(data.rows, data.total, { page, pageSize });
  }

  @Get('report')
  @ApiOperation({ summary: 'Generate attendance report across date range' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getReport(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: GetReportQueryDto,
  ): Promise<ApiResponse<unknown>> {
    if (!query?.from || !query?.to) throw badRequest('invalid_query', 'from and to are required');

    const data = await this.reportsService.getReport(claims, query.from, query.to, query.branch_id, query.group_id);
    return new ApiResponse(data);
  }

  @Get('today')
  @ApiOperation({ summary: 'Get today summary of attendance' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getToday(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: GetTodayQueryDto,
  ): Promise<ApiResponse<unknown>> {
    if (!query?.date) throw badRequest('invalid_query', 'date is required');

    const data = await this.reportsService.getToday(claims, query.date);
    return new ApiResponse(data);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get attendance statistical metrics' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getStats(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: GetStatsQueryDto,
  ): Promise<ApiResponse<unknown>> {
    if (!query?.year || !query?.month) throw badRequest('invalid_query', 'year and month are required');

    const data = await this.reportsService.getStats(claims, query.year, query.month, query);
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post('probes')
  @ApiOperation({ summary: 'Get attendance face verification probes for members' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getProbes(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: GetProbesDto,
  ): Promise<ApiResponse<unknown>> {
    if (!body?.member_ids?.length) return new ApiResponse([]);

    const data = await this.reportsService.getProbes(claims, body.member_ids, body.from, body.to);
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('probe-paths')
  @ApiOperation({ summary: 'Get list of all probe paths (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<string[]> })
  async getProbePaths(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<string[]>> {
    const data = await this.reportsService.getProbePaths(claims);
    return new ApiResponse(data);
  }
}
