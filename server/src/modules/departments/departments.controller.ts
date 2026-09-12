import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../domain/identity/role.js';
import { badRequest } from '../../common/errors.js';
import { DepartmentsService } from './departments.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { DepartmentDto, UpdateDepartmentDto, PutMemberDepartmentDto } from './dto/department.dto.js';
import { Role } from '../../common/enums/index.js';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('api/v1/departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get()
  @ApiOperation({ summary: 'Get all departments with branch names' })
  @SwaggerResponse({ status: 200, type: ApiResponse<DepartmentDto[]> })
  async getDepartments(): Promise<ApiResponse<DepartmentDto[]>> {
    const data = await this.departmentsService.getDepartments();
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('options')
  @ApiOperation({ summary: 'Get department options for select dropdowns' })
  @ApiQuery({ name: 'branch_id', required: false, type: String })
  @SwaggerResponse({ status: 200, type: ApiResponse<DepartmentDto[]> })
  async getDepartmentsOptions(
    @Query('branch_id') branchId?: string,
  ): Promise<ApiResponse<DepartmentDto[]>> {
    const data = await this.departmentsService.getDepartmentsOptions(branchId);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Put()
  @ApiOperation({ summary: 'Upsert a department' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true; id?: string }> })
  async putDepartment(
    @CallerDecorator() caller: Caller | null,
    @Body() body: UpdateDepartmentDto,
  ): Promise<ApiResponse<{ ok: boolean; id?: string }>> {
    const data = await this.departmentsService.putDepartment(caller!, {
      id: body.id,
      name: body.name,
      branch_id: body.branch_id ?? null,
    });
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a department' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteDepartment(
    @CallerDecorator() caller: Caller | null,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: boolean }>> {
    const data = await this.departmentsService.deleteDepartment(caller!, id);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Get('members')
  @ApiOperation({ summary: 'Get member-department mappings for month/year' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @SwaggerResponse({ status: 200, type: ApiResponse<Record<string, string>> })
  async getMemberDepartments(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ): Promise<ApiResponse<Record<string, string>>> {
    const y = Number(year);
    const m = Number(month);
    if (!y || !m) throw badRequest('invalid_query', 'Invalid year or month');

    const data = await this.departmentsService.getMemberDepartments(y, m);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Put('members')
  @ApiOperation({ summary: 'Assign or clear member department for month/year' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true; cleared?: boolean }> })
  async putMemberDepartment(
    @Body() body: PutMemberDepartmentDto,
  ): Promise<ApiResponse<{ ok: boolean; cleared?: boolean }>> {
    const data = await this.departmentsService.putMemberDepartment({
      member_id: body.member_id,
      year: body.year,
      month: body.month,
      department_id: body.department_id ?? null,
    });
    return new ApiResponse(data);
  }
}

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('api/v1/member-departments')
export class MemberDepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Get()
  @ApiOperation({ summary: 'Get member-department mappings for month/year' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @SwaggerResponse({ status: 200, type: ApiResponse<Record<string, string>> })
  async getMemberDepartments(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ): Promise<ApiResponse<Record<string, string>>> {
    const y = Number(year);
    const m = Number(month);
    if (!y || !m) throw badRequest('invalid_query', 'Invalid year or month');

    const data = await this.departmentsService.getMemberDepartments(y, m);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Put()
  @ApiOperation({ summary: 'Assign or clear member department for month/year' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true; cleared?: boolean }> })
  async putMemberDepartment(
    @Body() body: PutMemberDepartmentDto,
  ): Promise<ApiResponse<{ ok: boolean; cleared?: boolean }>> {
    const data = await this.departmentsService.putMemberDepartment({
      member_id: body.member_id,
      year: body.year,
      month: body.month,
      department_id: body.department_id ?? null,
    });
    return new ApiResponse(data);
  }
}

