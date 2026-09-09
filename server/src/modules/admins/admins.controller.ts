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
import type { JwtClaims } from '../../db/context.js';
import { AdminsService } from './admins.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import {
  AdminDto,
  UpdateAdminDto,
  CreateAdminAssignmentDto,
  AdminAssignmentResponseDto,
} from './dto/admin.dto.js';

@ApiTags('Admins')
@ApiBearerAuth()
@Controller('api/v1/admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Roles('admin', 'superadmin')
  @Get()
  @ApiOperation({ summary: 'Get all admins (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<AdminDto[]> })
  async getAdmins(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<AdminDto[]>> {
    const data = await this.adminsService.getAdmins(claims);
    return new ApiResponse(data);
  }

  @Roles('admin', 'superadmin')
  @Get('assignments')
  @ApiOperation({ summary: 'Get all admin branch/group assignments (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<AdminAssignmentResponseDto[]> })
  async getAssignments(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<AdminAssignmentResponseDto[]>> {
    const data = await this.adminsService.getAssignments(claims);
    return new ApiResponse(data);
  }

  @Roles('superadmin')
  @Patch(':id')
  @ApiOperation({ summary: 'Update admin profile and permissions (Superadmin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async updateAdmin(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
    @Body() body: UpdateAdminDto,
  ): Promise<ApiResponse<{ ok: true }>> {
    const data = await this.adminsService.updateAdmin(claims, id, body);
    return new ApiResponse(data);
  }

  @Roles('superadmin')
  @Post('assignments')
  @ApiOperation({ summary: 'Assign admin to branch or group (Superadmin only)' })
  @SwaggerResponse({ status: 201, type: ApiResponse<AdminAssignmentResponseDto> })
  async createAssignment(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: CreateAdminAssignmentDto,
  ): Promise<ApiResponse<AdminAssignmentResponseDto>> {
    const data = await this.adminsService.createAssignment(
      claims,
      body.admin_id,
      body.group_id ?? null,
      body.branch_id ?? null,
    );
    return new ApiResponse(data);
  }

  @Roles('superadmin')
  @Delete('assignments/:id')
  @ApiOperation({ summary: 'Delete admin assignment (Superadmin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteAssignment(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.adminsService.deleteAssignment(claims, id);
    return new ApiResponse({ ok: true });
  }
}
