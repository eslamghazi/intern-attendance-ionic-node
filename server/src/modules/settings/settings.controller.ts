import { Controller, Get, Patch, Put, Body, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Page } from '../../common/decorators/page.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { AuthService } from '../auth/auth.service.js';
import { SettingsService } from './settings.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import {
  BrandingResponseDto,
  SettingsResponseDto,
  UpdateSettingsDto,
  MasterPasswordStatusResponseDto,
  SetMasterPasswordDto,
} from './dto/settings.dto.js';
import { Role } from '../../common/enums/index.js';
import { IndexPageService } from '../../infrastructure/web/index-page.service.js';
import { BRANDING_FALLBACK_ICON } from '../../infrastructure/web/index-page.constants.js';

@ApiTags('Settings')
@Controller('api/v1/settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly authService: AuthService,
    private readonly indexPage: IndexPageService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get application settings' })
  @SwaggerResponse({ status: 200, type: ApiResponse<SettingsResponseDto | null> })
  async getSettings(
    @CallerDecorator() caller: Caller | null,
  ): Promise<ApiResponse<SettingsResponseDto | null>> {
    if (!caller) return new ApiResponse(null);
    const data = await this.settingsService.getSettings();
    return new ApiResponse(data);
  }

  @Public()
  @Get('branding')
  @ApiOperation({ summary: 'Get public branding settings' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BrandingResponseDto | null> })
  async getBranding(): Promise<ApiResponse<BrandingResponseDto | null>> {
    const data = await this.settingsService.getBranding();
    return new ApiResponse(data);
  }

  /**
   * The organisation's logo as an image, for the link preview.
   *
   * A preview crawler needs a plain image URL — it cannot read a data URL out
   * of a JSON body — so the logo Settings stores is decoded and served here.
   * The app's own icon stands in when there is none, so a shared link always
   * carries a picture. Public: the crawler has no token. Cached briefly, the
   * way IndexPageService remembers the name beside it.
   */
  @Public()
  @Get('branding/logo.png')
  @ApiOperation({ summary: "The organisation's logo as a PNG/JPEG, or the app icon" })
  async getBrandingLogo(@Res() reply: FastifyReply): Promise<void> {
    const { logo } = await this.indexPage.publicBranding();
    const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(logo ?? '');
    // Headers are set and send() is called in ONE chain: a Fastify reply is a
    // thenable that resolves once the response is sent, so awaiting it any
    // earlier waits forever.
    reply.header('cache-control', 'public, max-age=300');
    if (m) {
      await reply.header('content-type', `image/${m[1]}`).send(Buffer.from(m[2]!, 'base64'));
      return;
    }
    const root = this.indexPage.clientDist;
    if (!root) {
      await reply.code(404).send();
      return;
    }
    await reply.header('content-type', 'image/png').send(readFileSync(join(root, BRANDING_FALLBACK_ICON)));
  }

  @ApiBearerAuth()
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Page('settings', 'edit')
  @Patch()
  @ApiOperation({ summary: 'Update system settings (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async updateSettings(
    @Body() body: UpdateSettingsDto,
  ): Promise<ApiResponse<{ ok: true }>> {
    const data = await this.settingsService.updateSettings(body);
    // The link preview shows the name and logo; it must not show last hour's.
    this.indexPage.invalidate();
    return new ApiResponse(data);
  }

  @ApiBearerAuth()
  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Page('settings')
  @Get('master-password')
  @ApiOperation({ summary: 'Check if master password is configured' })
  @SwaggerResponse({ status: 200, type: ApiResponse<MasterPasswordStatusResponseDto> })
  async getMasterPassword(): Promise<ApiResponse<MasterPasswordStatusResponseDto>> {
    const configured = await this.authService.masterPasswordIsSet();
    return new ApiResponse(new MasterPasswordStatusResponseDto(configured));
  }

  @ApiBearerAuth()
  @Roles(Role.SUPERADMIN)
  @Put('master-password')
  @ApiOperation({ summary: 'Set or change master password (Superadmin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async setMasterPassword(@Body() body: SetMasterPasswordDto): Promise<ApiResponse<{ ok: true }>> {
    await this.authService.setMasterPassword(body.password);
    return new ApiResponse({ ok: true });
  }
}
