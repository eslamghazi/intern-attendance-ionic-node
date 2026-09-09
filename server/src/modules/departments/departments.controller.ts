import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import type { JwtClaims } from '../../db/context.js';
import { badRequest } from '../../http/errors.js';
import { DepartmentsService } from './departments.service.js';

@Controller('api/v1')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get('departments')
  async getDepartments(@ClaimsDecorator() claims: JwtClaims) {
    return this.departmentsService.getDepartments(claims);
  }

  @Get('departments/options')
  async getDepartmentsOptions(
    @ClaimsDecorator() claims: JwtClaims,
    @Query('branch_id') branchId?: string,
  ) {
    return this.departmentsService.getDepartmentsOptions(claims, branchId);
  }

  @Roles('admin', 'superadmin')
  @Put('departments')
  async putDepartment(
    @CallerDecorator() caller: Caller,
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1),
        branch_id: z.string().uuid().nullable(),
      })
      .safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid department payload');
    
    return this.departmentsService.putDepartment(caller, claims, parsed.data);
  }

  @Roles('admin', 'superadmin')
  @Delete('departments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDepartment(
    @CallerDecorator() caller: Caller,
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
  ) {
    await this.departmentsService.deleteDepartment(caller, claims, id);
  }

  @Get('member-departments')
  async getMemberDepartments(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() queryParams: unknown,
  ) {
    const q = z
      .object({ year: z.coerce.number().int(), month: z.coerce.number().int().min(1).max(12) })
      .safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'year and month are required');

    return this.departmentsService.getMemberDepartments(claims, q.data.year, q.data.month);
  }

  @Roles('admin', 'superadmin')
  @Put('member-departments')
  async putMemberDepartment(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({
        member_id: z.string().uuid(),
        year: z.coerce.number().int(),
        month: z.coerce.number().int().min(1).max(12),
        department_id: z.string().uuid().nullable(),
      })
      .safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid assignment payload');
    
    return this.departmentsService.putMemberDepartment(claims, parsed.data);
  }
}
