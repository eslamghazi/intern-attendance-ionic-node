import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { Role } from '../../common/enums/index.js';
import { ApiResponse, PaginatedResponse } from '../../common/dto/api-response.dto.js';
import { AuditService } from './audit.service.js';
import { AuditEntryDto, AuditQueryDto } from './dto/audit.dto.js';
import type { AuditFilters } from './audit.repository.js';

/**
 * Reading the audit trail. Staff only, and scoped — see AuditRepository for
 * exactly whose events an assigned admin may see.
 *
 * There is no write endpoint, and there must never be one. Every row is written
 * by the server as a side effect of something it did itself; a route that
 * accepted audit rows would let a caller forge the record of their own refusal.
 */
@ApiTags('Audit')
@ApiBearerAuth()
@Controller('api/v1/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  private toFilters(q: AuditQueryDto): AuditFilters {
    const events = q.event === undefined ? undefined : Array.isArray(q.event) ? q.event : [q.event];
    return {
      events,
      actorId: q.actor_id,
      from: q.from,
      to: q.to,
      // A query string carries no booleans. Anything but an explicit "false"
      // being truthy would make `?security_only=false` mean the opposite of
      // what it says.
      securityOnly: q.security_only === '1' || q.security_only === 'true',
    };
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Get()
  @ApiOperation({ summary: 'Page through the audit trail, newest first' })
  @SwaggerResponse({ status: 200, type: ApiResponse<AuditEntryDto[]> })
  async list(
    @CallerDecorator() caller: Caller,
    @Query() query: AuditQueryDto,
  ): Promise<PaginatedResponse<AuditEntryDto>> {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 50;
    const result = await this.auditService.list(
      caller,
      this.toFilters(query),
      pageSize,
      (page - 1) * pageSize,
    );
    return new PaginatedResponse(result.rows, result.total, { page, pageSize });
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Get('summary')
  @ApiOperation({ summary: 'Count per event type, for the same filters' })
  @SwaggerResponse({ status: 200, type: ApiResponse<Record<string, number>> })
  async summary(
    @CallerDecorator() caller: Caller,
    @Query() query: AuditQueryDto,
  ): Promise<ApiResponse<Record<string, number>>> {
    return new ApiResponse(await this.auditService.summary(caller, this.toFilters(query)));
  }
}
