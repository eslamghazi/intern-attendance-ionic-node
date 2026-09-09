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
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../domain/identity/role.js';
import type { JwtClaims } from '../../db/context.js';
import { badRequest } from '../../http/errors.js';
import { DepartmentsService } from './departments.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { DepartmentDto, UpdateDepartmentDto, PutMemberDepartmentDto } from './dto/department.dto.js';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('api/v1/departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all departments with branch names' })
  @SwaggerResponse({ status: 200, type: ApiResponse<DepartmentDto[]> })
  async getDepartments(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<DepartmentDto[]>> {
    const data = await this.departmentsService.getDepartments(claims);
    return new ApiResponse(data);
  }

  @Get('options')
  @ApiOperation({ summary: 'Get department options for select dropdowns' })
  @ApiQuery({ name: 'branch_id', required: false, type: String })
  @SwaggerResponse({ status: 200, type: ApiResponse<DepartmentDto[]> })
  async getDepartmentsOptions(
    @ClaimsDecorator() claims: JwtClaims,
    @Query('branch_id') branchId?: string,
  ): Promise<ApiResponse<DepartmentDto[]>> {
    const data = await this.departmentsService.getDepartmentsOptions(claims, branchId);
    return new ApiResponse(data);
  }

  @Roles('superadmin', 'admin')
  @Put()
  @ApiOperation({ summary: 'Upsert a department' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true; id?: string }> })
  async putDepartment(
    @CallerDecorator() caller: Caller | null,
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: UpdateDepartmentDto,
  ): Promise<ApiResponse<{ ok: boolean; id?: string }>> {
    const data = await this.departmentsService.putDepartment(caller!, claims, {
      id: body.id,
      name: body.name,
      branch_id: body.branch_id ?? null,
    });
    return new ApiResponse(data);
  }

  @Roles('superadmin', 'admin')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a department' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteDepartment(
    @CallerDecorator() caller: Caller | null,
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: boolean }>> {
    const data = await this.departmentsService.deleteDepartment(caller!, claims, id);
    return new ApiResponse(data);
  }

  @Roles('superadmin', 'admin')
  @Get('members')
  @ApiOperation({ summary: 'Get member-department mappings for month/year' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @SwaggerResponse({ status: 200, type: ApiResponse<Record<string, string>> })
  async getMemberDepartments(
    @ClaimsDecorator() claims: JwtClaims,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ): Promise<ApiResponse<Record<string, string>>> {
    const y = Number(year);
    const m = Number(month);
    if (!y || !m) throw badRequest('invalid_query', 'Invalid year or month');

    const data = await this.departmentsService.getMemberDepartments(claims, y, m);
    return new ApiResponse(data);
  }

  @Roles('superadmin', 'admin')
  @Put('members')
  @ApiOperation({ summary: 'Assign or clear member department for month/year' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true; cleared?: boolean }> })
  async putMemberDepartment(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: PutMemberDepartmentDto,
  ): Promise<ApiResponse<{ ok: boolean; cleared?: boolean }>> {
    const data = await this.departmentsService.putMemberDepartment(claims, {
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

  @Roles('superadmin', 'admin')
  @Get()
  @ApiOperation({ summary: 'Get member-department mappings for month/year' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @SwaggerResponse({ status: 200, type: ApiResponse<Record<string, string>> })
  async getMemberDepartments(
    @ClaimsDecorator() claims: JwtClaims,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ): Promise<ApiResponse<Record<string, string>>> {
    const y = Number(year);
    const m = Number(month);
    if (!y || !m) throw badRequest('invalid_query', 'Invalid year or month');

    const data = await this.departmentsService.getMemberDepartments(claims, y, m);
    return new ApiResponse(data);
  }

  @Roles('superadmin', 'admin')
  @Put()
  @ApiOperation({ summary: 'Assign or clear member department for month/year' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true; cleared?: boolean }> })
  async putMemberDepartment(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: PutMemberDepartmentDto,
  ): Promise<ApiResponse<{ ok: boolean; cleared?: boolean }>> {
    const data = await this.departmentsService.putMemberDepartment(claims, {
      member_id: body.member_id,
      year: body.year,
      month: body.month,
      department_id: body.department_id ?? null,
    });
    return new ApiResponse(data);
  }
}

