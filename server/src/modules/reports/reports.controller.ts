import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { JwtClaims } from '../../db/context.js';
import { MAX_PAGE_SIZE } from '../../domain/member/filter.js';
import { filterQuery } from '../members/members.controller.dto.js';
import { badRequest } from '../../http/errors.js';
import { ReportsService } from './reports.service.js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

@Controller('api/v1/attendance')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('present')
  async getPresent(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() queryParams: unknown,
  ) {
    const q = z.object({ dates: z.string().min(1) }).safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'dates is required');
    const dates = q.data.dates.split(',').map((d) => d.trim()).filter(Boolean);

    return this.reportsService.getPresent(claims, dates);
  }

  @Get('review')
  async getReview(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() queryParams: unknown,
  ) {
    const q = z
      .object({ date: dateStr, branch_id: z.string().uuid().nullish() })
      .safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'date is required');

    return this.reportsService.getReview(claims, q.data.date, q.data.branch_id);
  }

  @Get('detail')
  async getDetail(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() queryParams: unknown,
  ) {
    const q = z
      .object({
        member_id: z.string().uuid(),
        date: dateStr,
        shift_id: z.string().uuid().nullish(),
      })
      .safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'member_id and date are required');

    return this.reportsService.getDetail(claims, q.data.member_id, q.data.date, q.data.shift_id);
  }

  @Get('history')
  async getHistory(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() queryParams: unknown,
  ) {
    const q = z
      .object({
        member_id: z.string().uuid(),
        year: z.coerce.number().int().optional(),
        month: z.coerce.number().int().min(1).max(12).optional(),
      })
      .safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'member_id is required');

    return this.reportsService.getHistory(claims, q.data.member_id, q.data.year, q.data.month);
  }

  @Get('day')
  async getDay(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() queryParams: unknown,
  ) {
    const q = z
      .object({ member_id: z.string().uuid(), date: dateStr })
      .safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'member_id and date are required');

    return this.reportsService.getDay(claims, q.data.member_id, q.data.date);
  }

  @Get('daily-roster')
  async getDailyRoster(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() queryParams: unknown,
  ) {
    const q = z
      .object({ date: dateStr, branch_id: z.string().uuid().nullish() })
      .safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'date is required');

    return this.reportsService.getDailyRoster(claims, q.data.date, q.data.branch_id);
  }

  @Get('monthly')
  async getMonthly(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() queryParams: unknown,
  ) {
    const q = filterQuery
      .extend({
        year: z.coerce.number().int(),
        month: z.coerce.number().int().min(1).max(12),
        page: z.coerce.number().int().min(1).default(1),
        page_size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
      })
      .safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'invalid query');
    
    const { page, page_size: pageSize, year, month, ...filters } = q.data;

    return this.reportsService.getMonthly(claims, filters, year, month, page, pageSize);
  }

  @Get('report')
  async getReport(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() queryParams: unknown,
  ) {
    const q = z
      .object({
        from: dateStr,
        to: dateStr,
        branch_id: z.string().uuid().nullish(),
        group_id: z.string().uuid().nullish(),
      })
      .safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'from and to are required');

    return this.reportsService.getReport(claims, q.data.from, q.data.to, q.data.branch_id, q.data.group_id);
  }

  @Get('today')
  async getToday(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() queryParams: unknown,
  ) {
    const q = z.object({ date: dateStr }).safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'date is required');

    return this.reportsService.getToday(claims, q.data.date);
  }

  @Get('stats')
  async getStats(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() queryParams: unknown,
  ) {
    const q = z
      .object({
        year: z.coerce.number().int(),
        month: z.coerce.number().int().min(1).max(12),
        day: z.coerce.number().int().min(1).max(31).nullish(),
        branchId: z.string().uuid().nullish(),
        groupId: z.string().uuid().nullish(),
        shiftId: z.string().uuid().nullish(),
        departmentId: z.string().uuid().nullish(),
      })
      .safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'year and month are required');
    const f = q.data;

    return this.reportsService.getStats(claims, f.year, f.month, f);
  }

  @Roles('admin', 'superadmin')
  @Post('probes')
  async getProbes(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({ member_ids: z.array(z.string().uuid()), from: dateStr, to: dateStr })
      .safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid query');
    if (!parsed.data.member_ids.length) return [];

    return this.reportsService.getProbes(claims, parsed.data.member_ids, parsed.data.from, parsed.data.to);
  }

  @Roles('admin', 'superadmin')
  @Get('probe-paths')
  async getProbePaths(@ClaimsDecorator() claims: JwtClaims) {
    return this.reportsService.getProbePaths(claims);
  }
}
