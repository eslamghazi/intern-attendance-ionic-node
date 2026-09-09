import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { MAX_PAGE_SIZE } from '../../domain/member/filter.js';
import { filterQuery } from '../members/members.controller.dto.js';
import { badRequest } from '../../http/errors.js';
import { RosterService } from './roster.service.js';

const monthQuery = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

const dayInput = z.object({
  member_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift_id: z.string().uuid(),
});

@Controller('api/v1/roster')
export class RosterController {
  constructor(private readonly service: RosterService) {}

  @Roles('admin', 'superadmin')
  @Get('view')
  async getRosterView(
    @CallerDecorator() caller: Caller,
    @Query() queryParams: unknown,
  ) {
    const q = filterQuery
      .merge(monthQuery)
      .merge(
        z.object({
          page: z.coerce.number().int().min(1).default(1),
          page_size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
        }),
      )
      .safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'invalid query');
    const { page, page_size: pageSize, year, month, ...filters } = q.data;
    const offset = (page - 1) * pageSize;

    return this.service.getRosterView(caller, filters, year, month, pageSize, offset);
  }

  @Roles('admin', 'superadmin')
  @Get('totals')
  async getRosterTotals(
    @CallerDecorator() caller: Caller,
    @Query() queryParams: unknown,
  ) {
    const q = filterQuery.merge(monthQuery).safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'invalid query');
    const o = q.data;

    return this.service.getRosterTotals(caller, o, o.year, o.month);
  }

  @Get('maker-data')
  async getMakerData(
    @CallerDecorator() caller: Caller,
    @Query() queryParams: unknown,
  ) {
    const q = monthQuery.safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'year and month are required');
    
    return this.service.getMakerData(caller, q.data.year, q.data.month);
  }

  @Roles('admin', 'superadmin')
  @Post('existing-keys')
  async getExistingKeys(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = monthQuery
      .extend({ member_ids: z.array(z.string().uuid()) })
      .safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid query');
    
    return this.service.getExistingKeys(caller, parsed.data.year, parsed.data.month, parsed.data.member_ids);
  }

  @Post('days')
  async postRosterDays(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = z
      .union([dayInput, z.object({ days: z.array(dayInput) })])
      .safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid roster payload');
    const days = 'days' in parsed.data ? parsed.data.days : [parsed.data];
    
    return this.service.postRosterDays(caller, days);
  }

  @Delete('days')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRosterDays(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = dayInput.safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid roster payload');
    const d = parsed.data;
    
    await this.service.deleteRosterDays(caller, d);
  }

  @Post('bulk')
  async bulkRoster(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = filterQuery
      .merge(monthQuery)
      .extend({
        shift_id: z.string().uuid(),
        from_day: z.coerce.number().int().min(1).max(31),
        to_day: z.coerce.number().int().min(1).max(31),
        mode: z.enum(['add', 'remove', 'replace']),
      })
      .safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid bulk payload');
    
    return this.service.bulkRoster(caller, parsed.data);
  }
}
