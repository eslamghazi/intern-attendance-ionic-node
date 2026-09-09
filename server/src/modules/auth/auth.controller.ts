import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import type { JwtClaims } from '../../db/context.js';
import * as schema from '../../db/schema/index.js';
import { AuthService } from './auth.service.js';
import { badRequest } from '../../http/errors.js';

const loginBody = z.object({
  national_id: z.string().trim().min(1),
  password: z.string().default(''),
});

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() body: unknown,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    const parsed = loginBody.safeParse(body);
    if (!parsed.success) throw badRequest('invalid_body', 'national_id is required');
    return this.authService.login(
      parsed.data.national_id,
      parsed.data.password,
      userAgent ?? null,
    );
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() body: unknown,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    const parsed = z.object({ refresh_token: z.string().min(1) }).safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'refresh_token is required');
    return this.authService.refresh(parsed.data.refresh_token, userAgent ?? null);
  }

  @Public()
  @Post('logout')
  async logout(@Body() body: unknown) {
    const parsed = z.object({ refresh_token: z.string().nullish() }).safeParse(body ?? {});
    await this.authService.logout(parsed.success ? (parsed.data.refresh_token ?? null) : null);
    return { ok: true };
  }

  @Post('logout-all')
  async logoutAll(@CallerDecorator() caller: Caller) {
    const { revoked } = await this.authService.logoutEverywhere(caller);
    return { ok: true, revoked };
  }

  @Get('me')
  async me(
    @CallerDecorator() caller: Caller,
    @ClaimsDecorator() claims: JwtClaims,
  ) {
    return this.authService.getMe(caller);
  }

  @Post('password')
  async changePassword(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    const parsed = z
      .object({ current: z.string().trim().min(1), new: z.string().trim().min(6) })
      .safeParse(body);
    if (!parsed.success) {
      throw badRequest('invalid', 'current is required and the new password must be 6+ chars');
    }
    const pair = await this.authService.changeOwnPassword(
      caller,
      parsed.data.current,
      parsed.data.new,
      userAgent ?? null,
    );
    return { ok: true, ...pair };
  }

  @Post('password/initial')
  async setInitialPassword(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    const parsed = z.object({ new: z.string().trim().min(6) }).safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'the new password must be 6+ chars');
    const pair = await this.authService.setInitialPassword(
      caller,
      parsed.data.new,
      userAgent ?? null,
    );
    return { ok: true, ...pair };
  }

  @Roles('admin', 'superadmin')
  @Post('members/reset-password')
  async resetMemberPassword(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({
        profile_id: z.string().uuid().optional(),
        national_id: z.string().trim().optional(),
        password: z.string().trim().optional(),
      })
      .refine((b) => b.profile_id || b.national_id, { message: 'profile_id or national_id' })
      .safeParse(body);
    if (!parsed.success) throw badRequest('missing', 'profile_id or national_id is required');

    const { password } = await this.authService.resetPassword(caller, {
      profileId: parsed.data.profile_id,
      nationalId: parsed.data.national_id,
      expect: 'member',
      password: parsed.data.password,
    });
    return { ok: true, password };
  }

  @Roles('admin', 'superadmin')
  @Post('staff/reset-password')
  async resetStaffPassword(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({ profile_id: z.string().uuid(), password: z.string().trim().optional() })
      .safeParse(body);
    if (!parsed.success) throw badRequest('missing', 'profile_id is required');

    const { password } = await this.authService.resetPassword(caller, {
      profileId: parsed.data.profile_id,
      expect: 'staff',
      password: parsed.data.password,
    });
    return { ok: true, password };
  }

  @Roles('superadmin')
  @Post('staff')
  @HttpCode(HttpStatus.CREATED)
  async createStaff(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({
        national_id: z.string().trim(),
        full_name: z.string().trim().min(1),
        phone: z.string().nullish(),
        password: z.string().trim().optional(),
        role: z.enum(['admin']).default('admin'),
        assignments: z
          .array(z.object({ group_id: z.string().nullish(), branch_id: z.string().nullish() }))
          .default([]),
      })
      .safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid staff payload');

    const created = await this.authService.createStaff(caller, parsed.data);
    return { ok: true, id: created.id, password: created.password };
  }

  @Roles('superadmin')
  @Delete('staff/:id')
  async deleteStaff(
    @CallerDecorator() caller: Caller,
    @Param('id') id: string,
  ) {
    await this.authService.deleteStaff(caller, id);
    return { ok: true };
  }
}
