import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { JwtClaims } from '../../db/context.js';
import { AdminsService } from './admins.service.js';
import { badRequest } from '../../http/errors.js';

@Controller('api/v1/admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Roles('admin', 'superadmin')
  @Get()
  async getAdmins(@ClaimsDecorator() claims: JwtClaims) {
    return this.adminsService.getAdmins(claims);
  }

  @Roles('admin', 'superadmin')
  @Get('assignments')
  async getAssignments(@ClaimsDecorator() claims: JwtClaims) {
    return this.adminsService.getAssignments(claims);
  }

  @Roles('superadmin')
  @Patch(':id')
  async updateAdmin(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({
        full_name: z.string().trim().min(1),
        national_id: z.string().trim().min(1),
        phone: z.string().nullish(),
        permissions: z.unknown().optional(),
      })
      .safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid admin payload');
    const b = parsed.data;

    return this.adminsService.updateAdmin(claims, id, b);
  }

  @Roles('superadmin')
  @Post('assignments')
  @HttpCode(HttpStatus.CREATED)
  async createAssignment(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({
        admin_id: z.string().uuid(),
        group_id: z.string().uuid().nullish(),
        branch_id: z.string().uuid().nullish(),
      })
      .safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid assignment payload');
    const b = parsed.data;

    return this.adminsService.createAssignment(claims, b.admin_id, b.group_id ?? null, b.branch_id ?? null);
  }

  @Roles('superadmin')
  @Delete('assignments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAssignment(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
  ) {
    await this.adminsService.deleteAssignment(claims, id);
  }
}
