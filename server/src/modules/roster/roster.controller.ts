import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { badRequest } from '../../http/errors.js';
import { RosterService } from './roster.service.js';
import { ApiResponse, PaginatedResponse } from '../../common/dto/api-response.dto.js';
import {
  MonthQueryDto,
  RosterDayInputDto,
  GetRosterViewQueryDto,
  GetExistingKeysDto,
  PostRosterDaysDto,
  BulkRosterDto,
} from './dto/roster.dto.js';

@ApiTags('Roster')
@ApiBearerAuth()
@Controller('api/v1/roster')
export class RosterController {
  constructor(private readonly service: RosterService) {}

  @Roles('admin', 'superadmin')
  @Get('view')
  @ApiOperation({ summary: 'Get monthly roster grid view with pagination (Admin only)' })
  @SwaggerResponse({ status: 200, type: PaginatedResponse<unknown> })
  async getRosterView(
    @CallerDecorator() caller: Caller | null,
    @Query() query: GetRosterViewQueryDto,
  ): Promise<PaginatedResponse<unknown>> {
    const { page = 1, page_size: pageSize = 50, year, month, ...filters } = query;
    if (!year || !month) throw badRequest('invalid_query', 'year and month are required');
    const offset = (page - 1) * pageSize;

    const data = await this.service.getRosterView(caller!, filters, year, month, pageSize, offset);
    return new PaginatedResponse(data.rows, data.total, { page, pageSize });
  }

  @Roles('admin', 'superadmin')
  @Get('totals')
  @ApiOperation({ summary: 'Get monthly roster totals (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getRosterTotals(
    @CallerDecorator() caller: Caller | null,
    @Query() query: GetRosterViewQueryDto,
  ): Promise<ApiResponse<unknown>> {
    const { year, month, ...filters } = query;
    if (!year || !month) throw badRequest('invalid_query', 'year and month are required');

    const data = await this.service.getRosterTotals(caller!, filters, year, month);
    return new ApiResponse(data);
  }

  @Get('maker-data')
  @ApiOperation({ summary: 'Get roster maker options and metadata for given month' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getMakerData(
    @CallerDecorator() caller: Caller | null,
    @Query() query: MonthQueryDto,
  ): Promise<ApiResponse<unknown>> {
    if (!query?.year || !query?.month) throw badRequest('invalid_query', 'year and month are required');

    const data = await this.service.getMakerData(caller!, query.year, query.month);
    return new ApiResponse(data);
  }

  @Roles('admin', 'superadmin')
  @Post('existing-keys')
  @ApiOperation({ summary: 'Query existing roster schedule keys for members (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getExistingKeys(
    @CallerDecorator() caller: Caller | null,
    @Body() body: GetExistingKeysDto,
  ): Promise<ApiResponse<unknown>> {
    if (!body?.year || !body?.month || !body?.member_ids) {
      throw badRequest('invalid_body', 'year, month, and member_ids are required');
    }

    const data = await this.service.getExistingKeys(caller!, body.year, body.month, body.member_ids);
    return new ApiResponse(data);
  }

  @Post('days')
  @ApiOperation({ summary: 'Assign one or more member roster shift days' })
  @SwaggerResponse({ status: 201, type: ApiResponse<unknown> })
  async postRosterDays(
    @CallerDecorator() caller: Caller | null,
    @Body() body: PostRosterDaysDto,
  ): Promise<ApiResponse<unknown>> {
    let days: RosterDayInputDto[] = [];
    if (body?.days && Array.isArray(body.days)) {
      days = body.days;
    } else if (body?.member_id && body?.date && body?.shift_id) {
      days = [{ member_id: body.member_id, date: body.date, shift_id: body.shift_id }];
    } else {
      throw badRequest('invalid_body', 'invalid roster payload');
    }

    const data = await this.service.postRosterDays(caller!, days);
    return new ApiResponse(data);
  }

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

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk schedule roster shifts across members' })
  @SwaggerResponse({ status: 201, type: ApiResponse<unknown> })
  async bulkRoster(
    @CallerDecorator() caller: Caller | null,
    @Body() body: BulkRosterDto,
  ): Promise<ApiResponse<unknown>> {
    if (!body?.year || !body?.month || !body?.shift_id || !body?.mode) {
      throw badRequest('invalid_body', 'invalid bulk payload');
    }

    const data = await this.service.bulkRoster(caller!, body);
    return new ApiResponse(data);
  }
}
