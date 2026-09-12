import { Controller, Get, Patch, Put, Body } from '@nestjs/common';
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

@ApiTags('Settings')
@Controller('api/v1/settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly authService: AuthService,
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
