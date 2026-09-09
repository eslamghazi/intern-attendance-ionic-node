import { Controller, Get, Patch, Put, Body } from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import type { JwtClaims } from '../../db/context.js';
import { AuthService } from '../auth/auth.service.js';
import { SettingsService } from './settings.service.js';
import { badRequest } from '../../http/errors.js';

@Controller('api/v1/settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get()
  async getSettings(
    @CallerDecorator() caller: Caller | null,
    @ClaimsDecorator() claims: JwtClaims | null,
  ) {
    if (!caller) return null;
    return this.settingsService.getSettings(claims);
  }

  @Public()
  @Get('branding')
  async getBranding() {
    return this.settingsService.getBranding();
  }

  @Roles('superadmin', 'admin')
  @Patch()
  async updateSettings(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: unknown,
  ) {
    const b = (body ?? {}) as Record<string, unknown>;
    return this.settingsService.updateSettings(claims, b);
  }

  @Get('master-password')
  async getMasterPassword() {
    return { configured: await this.authService.masterPasswordIsSet() };
  }

  @Roles('superadmin')
  @Put('master-password')
  async setMasterPassword(@Body() body: unknown) {
    const parsed = z.object({ password: z.string() }).safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'password is required');
    await this.authService.setMasterPassword(parsed.data.password);
    return { ok: true };
  }
}
