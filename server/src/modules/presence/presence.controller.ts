import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { badRequest } from '../../http/errors.js';
import { PresenceService } from './presence.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import {
  CreatePresenceCheckDto,
  ConfirmPresenceByAdminDto,
  ResolvePresenceCheckDto,
  ConfirmPresenceByMemberDto,
  CreatePresenceCheckResponseDto,
} from './dto/presence.dto.js';
import { PresenceMapper } from './presence.mapper.js';

@ApiTags('Presence')
@ApiBearerAuth()
@Controller('api/v1/presence')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Roles('admin', 'superadmin')
  @Post('checks')
  @ApiOperation({ summary: 'Create a new spot-check verification session (Admin only)' })
  @SwaggerResponse({ status: 201, type: ApiResponse<CreatePresenceCheckResponseDto> })
  async createCheck(
    @CallerDecorator() caller: Caller | null,
    @Body() body: CreatePresenceCheckDto,
  ): Promise<ApiResponse<CreatePresenceCheckResponseDto>> {
    const data = await this.presenceService.createCheck(caller!, {
      branch_id: body?.branch_id,
      group_id: body?.group_id,
      department_id: body?.department_id,
      shift_id: body?.shift_id,
      deadline_minutes: body?.deadline_minutes ?? 10,
    });
    return new ApiResponse(PresenceMapper.toCreateCheckResponse(data));
  }

  @Roles('admin', 'superadmin')
  @Get('checks')
  @ApiOperation({ summary: 'Get active and recent spot-checks created by admin' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getChecks(@CallerDecorator() caller: Caller | null): Promise<ApiResponse<unknown>> {
    const data = await this.presenceService.getChecks(caller!.id);
    return new ApiResponse(data);
  }

  @Roles('admin', 'superadmin')
  @Delete('checks/:id')
  @ApiOperation({ summary: 'Cancel or delete an active spot-check session' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteCheck(
    @CallerDecorator() caller: Caller | null,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.presenceService.deleteCheck(caller!.id, id);
    return new ApiResponse({ ok: true });
  }

  @Roles('admin', 'superadmin')
  @Post('checks/:id/confirm')
  @ApiOperation({ summary: 'Manually confirm a member presence during a spot-check (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async confirmByAdmin(
    @CallerDecorator() caller: Caller | null,
    @Param('id') id: string,
    @Body() body: ConfirmPresenceByAdminDto,
  ): Promise<ApiResponse<unknown>> {
    if (!body?.member_id) throw badRequest('invalid_body', 'member_id is required');

    const data = await this.presenceService.confirmByAdmin(caller!.id, id, body.member_id);
    return new ApiResponse(data);
  }

  @Roles('admin', 'superadmin')
  @Post('checks/:id/resolve')
  @ApiOperation({ summary: 'Resolve an expired or completed spot-check' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async resolveCheck(
    @CallerDecorator() caller: Caller | null,
    @Param('id') id: string,
    @Body() body: ResolvePresenceCheckDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.presenceService.resolveCheck(caller!.id, id, body?.decision ?? 'keep');
    return new ApiResponse(data);
  }

  @Roles('member')
  @Get('pending')
  @ApiOperation({ summary: 'Check if caller has pending spot-checks needing confirmation' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getPending(@CallerDecorator() caller: Caller | null): Promise<ApiResponse<unknown>> {
    const data = await this.presenceService.getPending(caller!.id);
    return new ApiResponse(data);
  }

  @Roles('member')
  @Post('confirm')
  @ApiOperation({ summary: 'Confirm presence for a spot-check (Member self-report)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async confirmByMember(
    @CallerDecorator() caller: Caller | null,
    @Body() body: ConfirmPresenceByMemberDto,
  ): Promise<ApiResponse<unknown>> {
    if (!body?.check_id) throw badRequest('invalid_body', 'check_id is required');

    const data = await this.presenceService.confirmByMember(caller!.id, body.check_id);
    return new ApiResponse(data);
  }
}
