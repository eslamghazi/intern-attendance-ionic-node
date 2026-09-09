import {
  Controller,
  Get,
  Post,
  Patch,
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
import { MembersService } from './members.service.js';
import { badRequest } from '../../http/errors.js';
import { filterQuery, pageQuery, updateSchema, memberInput } from './members.controller.dto.js'; // I'll create this DTO file to store schemas

@Controller('api/v1/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Roles('admin', 'superadmin')
  @Post()
  async createMembers(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = z
      .union([z.object({ members: z.array(memberInput) }), memberInput])
      .safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid member payload');
    const items = 'members' in parsed.data ? parsed.data.members : [parsed.data];
    return this.membersService.createMembers(caller, items);
  }

  @Roles('admin', 'superadmin')
  @Get('national-ids')
  async getNationalIds(@ClaimsDecorator() claims: JwtClaims) {
    return this.membersService.getNationalIds(claims);
  }

  @Get()
  async getMembers(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() queryParams: unknown,
  ) {
    const q = filterQuery.merge(pageQuery).safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'invalid query');
    const { page, page_size: pageSize, ...filters } = q.data;
    const offset = (page - 1) * pageSize;
    return this.membersService.getMembers(claims, filters, pageSize, offset);
  }

  @Get('page')
  async getMembersPage(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() queryParams: unknown,
  ) {
    const q = filterQuery.merge(pageQuery).safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'invalid query');
    const { page, page_size: pageSize, ...filters } = q.data;
    const offset = (page - 1) * pageSize;
    return this.membersService.getMembersPage(claims, filters, pageSize, offset);
  }

  @Get('flag-stats')
  async getFlagStats(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() queryParams: unknown,
  ) {
    const q = filterQuery.safeParse(queryParams);
    if (!q.success) throw badRequest('invalid', 'invalid query');
    return this.membersService.getFlagStats(claims, q.data);
  }

  @Get('count-active')
  async getCountActive(@ClaimsDecorator() claims: JwtClaims) {
    return this.membersService.getCountActive(claims);
  }

  @Get('by-profile/:profileId')
  async getByProfile(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('profileId') profileId: string,
  ) {
    return this.membersService.getByProfile(claims, profileId);
  }

  @Patch(':id')
  async updateMember(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid member payload');
    return this.membersService.updateMember(claims, id, parsed.data);
  }

  @Roles('admin', 'superadmin')
  @Delete('by-profile/:profileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteByProfile(
    @CallerDecorator() caller: Caller,
    @ClaimsDecorator() claims: JwtClaims,
    @Param('profileId') profileId: string,
  ) {
    await this.membersService.deleteByProfile(caller, claims, profileId);
  }

  @Post('bulk/flag')
  async bulkFlag(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: unknown,
  ) {
    const parsed = filterQuery
      .extend({
        flag: z.enum(['bypass_face', 'bypass_location']),
        value: z.boolean(),
      })
      .safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid bulk payload');
    const { flag, value, ...filters } = parsed.data;
    return this.membersService.bulkUpdate(claims, filters, { [flag]: value });
  }

  @Post('bulk/frozen')
  async bulkFrozen(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: unknown,
  ) {
    const parsed = filterQuery
      .extend({ frozen_at: z.string().nullable() })
      .safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid bulk payload');
    const { frozen_at: frozenAt, ...filters } = parsed.data;
    return this.membersService.bulkUpdate(claims, filters, { frozen_at: frozenAt });
  }

  @Post('bulk/update')
  async bulkUpdatePost(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: unknown,
  ) {
    const parsed = filterQuery
      .extend({
        group_id: z.string().uuid().optional(),
        branch_id: z.string().uuid().optional(),
        is_active: z.boolean().optional(),
      })
      .safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid bulk payload');
    const { group_id: groupId, branch_id: branchId, is_active: isActive, ...filters } = parsed.data;
    const patch: Record<string, unknown> = {};
    if (groupId) patch.group_id = groupId;
    if (branchId) patch.branch_id = branchId;
    if (isActive !== undefined) patch.is_active = isActive;
    return this.membersService.bulkUpdate(claims, filters, patch);
  }

  @Roles('admin', 'superadmin')
  @Post('bulk/delete')
  async bulkDelete(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: unknown,
  ) {
    const parsed = filterQuery.safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid bulk payload');
    return this.membersService.bulkDelete(claims, parsed.data);
  }
}
