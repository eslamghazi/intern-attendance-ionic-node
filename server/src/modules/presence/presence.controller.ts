import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { badRequest } from '../../http/errors.js';
import { PresenceService } from './presence.service.js';

@Controller('api/v1/presence')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Roles('admin', 'superadmin')
  @Post('checks')
  @HttpCode(HttpStatus.CREATED)
  async createCheck(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({
        branch_id: z.string().uuid().nullish(),
        group_id: z.string().uuid().nullish(),
        department_id: z.string().uuid().nullish(),
        shift_id: z.string().uuid().nullish(),
        deadline_minutes: z.coerce.number().int().default(10),
      })
      .safeParse(body ?? {});
    if (!parsed.success) throw badRequest('invalid', 'invalid spot-check payload');
    
    return this.presenceService.createCheck(caller, parsed.data);
  }

  @Roles('admin', 'superadmin')
  @Get('checks')
  async getChecks(@CallerDecorator() caller: Caller) {
    return this.presenceService.getChecks(caller.id);
  }

  @Roles('admin', 'superadmin')
  @Delete('checks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCheck(
    @CallerDecorator() caller: Caller,
    @Param('id') id: string,
  ) {
    await this.presenceService.deleteCheck(caller.id, id);
  }

  @Roles('admin', 'superadmin')
  @Post('checks/:id/confirm')
  async confirmByAdmin(
    @CallerDecorator() caller: Caller,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = z.object({ member_id: z.string().uuid() }).safeParse(body);
    if (!parsed.success) throw badRequest('missing', 'member_id is required');

    return this.presenceService.confirmByAdmin(caller.id, id, parsed.data.member_id);
  }

  @Roles('admin', 'superadmin')
  @Post('checks/:id/resolve')
  async resolveCheck(
    @CallerDecorator() caller: Caller,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({ decision: z.enum(['keep', 'left_work']).default('keep') })
      .safeParse(body ?? {});
    if (!parsed.success) throw badRequest('invalid', 'invalid decision');

    return this.presenceService.resolveCheck(caller.id, id, parsed.data.decision);
  }

  @Roles('member')
  @Get('pending')
  async getPending(@CallerDecorator() caller: Caller) {
    return this.presenceService.getPending(caller.id);
  }

  @Roles('member')
  @Post('confirm')
  async confirmByMember(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = z.object({ check_id: z.string().uuid() }).safeParse(body);
    if (!parsed.success) throw badRequest('missing', 'check_id is required');

    return this.presenceService.confirmByMember(caller.id, parsed.data.check_id);
  }
}
