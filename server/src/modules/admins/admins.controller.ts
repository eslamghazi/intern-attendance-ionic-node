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
import { Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
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
  @Get()
  @ApiOperation({ summary: 'Get all admins (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<AdminDto[]> })
  async getAdmins(): Promise<ApiResponse<AdminDto[]>> {
    const data = await this.adminsService.getAdmins();
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('assignments')
  @ApiOperation({ summary: 'Get all admin branch/group assignments (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<AdminAssignmentResponseDto[]> })
  async getAssignments(): Promise<ApiResponse<AdminAssignmentResponseDto[]>> {
    const data = await this.adminsService.getAssignments();
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update admin profile and permissions (Superadmin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async updateAdmin(
    @Param('id') id: string,
    @Body() body: UpdateAdminDto,
  ): Promise<ApiResponse<{ ok: true }>> {
    const data = await this.adminsService.updateAdmin(id, body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN)
  @Post('assignments')
  @ApiOperation({ summary: 'Assign admin to branch or group (Superadmin only)' })
  @SwaggerResponse({ status: 201, type: ApiResponse<AdminAssignmentResponseDto> })
  async createAssignment(
    @Body() body: CreateAdminAssignmentDto,
  ): Promise<ApiResponse<AdminAssignmentResponseDto>> {
    const data = await this.adminsService.createAssignment(
      body.admin_id,
      body.group_id ?? null,
      body.branch_id ?? null,
    );
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN)
  @Delete('assignments/:id')
  @ApiOperation({ summary: 'Delete admin assignment (Superadmin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteAssignment(
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.adminsService.deleteAssignment(id);
    return new ApiResponse({ ok: true });
  }
}
