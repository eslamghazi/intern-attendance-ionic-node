import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Page } from '../../common/decorators/page.decorator.js';
import {
  Caller as CallerDecorator,
  Claims as ClaimsDecorator,
} from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../domain/identity/types.js';
import { AdminsService } from './admins.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import {
  AdminDto,
  UpdateAdminDto,
  CreateAdminAssignmentDto,
  AdminAssignmentResponseDto,
} from './dto/admin.dto.js';
import { Role } from '../../common/enums/index.js';

@ApiTags('Admins')
@ApiBearerAuth()
@Controller('api/v1/admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('admins')
  @Get()
  @ApiOperation({ summary: 'Get every staff account but the caller (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<AdminDto[]> })
  async getAdmins(@CallerDecorator() caller: Caller): Promise<ApiResponse<AdminDto[]>> {
    const data = await this.adminsService.getAdmins(caller);
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('admins')
  @Get('assignments')
  @ApiOperation({ summary: 'Get all admin branch/group assignments (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<AdminAssignmentResponseDto[]> })
  async getAssignments(): Promise<ApiResponse<AdminAssignmentResponseDto[]>> {
    const data = await this.adminsService.getAssignments();
    return new ApiResponse(data);
  }

  // Managing staff is a PAGE now, like everything else: a superadmin holds it
  // by role, and may grant it to an admin. What an admin so granted may touch
  // is decided per target by mayManageStaff — other admins, never a
  // superadmin, never themselves.
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('admins', 'edit')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a staff account and its grant' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async updateAdmin(
    @CallerDecorator() caller: Caller,
    @Param('id') id: string,
    @Body() body: UpdateAdminDto,
  ): Promise<ApiResponse<{ ok: true }>> {
    const data = await this.adminsService.updateAdmin(caller, id, body);
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('admins', 'edit')
  @Post('assignments')
  @ApiOperation({ summary: 'Assign a staff account to a branch or group' })
  @SwaggerResponse({ status: 201, type: ApiResponse<AdminAssignmentResponseDto> })
  async createAssignment(
    @CallerDecorator() caller: Caller,
    @Body() body: CreateAdminAssignmentDto,
  ): Promise<ApiResponse<AdminAssignmentResponseDto>> {
    const data = await this.adminsService.createAssignment(
      caller,
      body.admin_id,
      body.group_id ?? null,
      body.branch_id ?? null,
    );
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('admins', 'edit')
  @Delete('assignments/:id')
  @ApiOperation({ summary: 'Remove a staff assignment' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteAssignment(
    @CallerDecorator() caller: Caller,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.adminsService.deleteAssignment(caller, id);
    return new ApiResponse({ ok: true });
  }
}
