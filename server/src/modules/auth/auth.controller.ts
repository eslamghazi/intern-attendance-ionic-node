import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import type { JwtClaims } from '../../db/context.js';
import { AuthService } from './auth.service.js';
import { badRequest } from '../../http/errors.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import {
  LoginDto,
  RefreshTokenDto,
  LogoutDto,
  ChangePasswordDto,
  InitialPasswordDto,
  ResetMemberPasswordDto,
  ResetStaffPasswordDto,
  CreateStaffDto,
  LoginResultDto,
} from './dto/auth.dto.js';
import { AuthMapper } from './auth.mapper.js';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Sign in with national ID and password' })
  @SwaggerResponse({ status: 200, type: ApiResponse<LoginResultDto> })
  async login(
    @Body() body: LoginDto,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<ApiResponse<LoginResultDto>> {
    if (!body?.national_id) {
      throw badRequest('invalid_body', 'national_id is required');
    }
    const result = await this.authService.login(
      body.national_id,
      body.password ?? '',
      userAgent ?? null,
    );
    return new ApiResponse(AuthMapper.toLoginResultDto(result));
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Renew access token using refresh token' })
  @SwaggerResponse({ status: 200, type: ApiResponse<LoginResultDto> })
  async refresh(
    @Body() body: RefreshTokenDto,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<ApiResponse<LoginResultDto>> {
    if (!body?.refresh_token) {
      throw badRequest('invalid_body', 'refresh_token is required');
    }
    const result = await this.authService.refresh(body.refresh_token, userAgent ?? null);
    return new ApiResponse(AuthMapper.toLoginResultDto(result));
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Invalidate current refresh token' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async logout(@Body() body: LogoutDto): Promise<ApiResponse<{ ok: true }>> {
    await this.authService.logout(body?.refresh_token ?? null);
    return new ApiResponse({ ok: true });
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @ApiOperation({ summary: 'Invalidate all refresh tokens for caller' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true; revoked: number }> })
  async logoutAll(@CallerDecorator() caller: Caller | null): Promise<ApiResponse<{ ok: true; revoked: number }>> {
    const { revoked } = await this.authService.logoutEverywhere(caller!);
    return new ApiResponse({ ok: true, revoked });
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async me(
    @CallerDecorator() caller: Caller | null,
    @ClaimsDecorator() _claims: JwtClaims,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.authService.getMe(caller!);
    return new ApiResponse(data);
  }

  @ApiBearerAuth()
  @Post('password')
  @ApiOperation({ summary: 'Change current user password' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true; access_token: string; refresh_token: string }> })
  async changePassword(
    @CallerDecorator() caller: Caller | null,
    @Body() body: ChangePasswordDto,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<ApiResponse<{ ok: true; access_token: string; refresh_token: string }>> {
    if (!body?.current || !body?.new || body.new.length < 6) {
      throw badRequest('invalid_body', 'current is required and the new password must be 6+ chars');
    }
    const pair = await this.authService.changeOwnPassword(
      caller!,
      body.current,
      body.new,
      userAgent ?? null,
    );
    return new ApiResponse({ ok: true, ...pair });
  }

  @ApiBearerAuth()
  @Post('password/initial')
  @ApiOperation({ summary: 'Set initial password for first-time login' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true; access_token: string; refresh_token: string }> })
  async setInitialPassword(
    @CallerDecorator() caller: Caller | null,
    @Body() body: InitialPasswordDto,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<ApiResponse<{ ok: true; access_token: string; refresh_token: string }>> {
    if (!body?.new || body.new.length < 6) {
      throw badRequest('invalid_body', 'the new password must be 6+ chars');
    }
    const pair = await this.authService.setInitialPassword(
      caller!,
      body.new,
      userAgent ?? null,
    );
    return new ApiResponse({ ok: true, ...pair });
  }

  @ApiBearerAuth()
  @Roles('admin', 'superadmin')
  @Post('members/reset-password')
  @ApiOperation({ summary: 'Reset a member password (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true; password: string }> })
  async resetMemberPassword(
    @CallerDecorator() caller: Caller | null,
    @Body() body: ResetMemberPasswordDto,
  ): Promise<ApiResponse<{ ok: true; password: string }>> {
    if (!body?.profile_id && !body?.national_id) {
      throw badRequest('invalid_body', 'profile_id or national_id is required');
    }

    const { password } = await this.authService.resetPassword(caller!, {
      profileId: body.profile_id,
      nationalId: body.national_id,
      expect: 'member',
      password: body.password,
    });
    return new ApiResponse({ ok: true, password });
  }

  @ApiBearerAuth()
  @Roles('admin', 'superadmin')
  @Post('staff/reset-password')
  @ApiOperation({ summary: 'Reset a staff password (Admin/Superadmin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true; password: string }> })
  async resetStaffPassword(
    @CallerDecorator() caller: Caller | null,
    @Body() body: ResetStaffPasswordDto,
  ): Promise<ApiResponse<{ ok: true; password: string }>> {
    if (!body?.profile_id) {
      throw badRequest('invalid_body', 'profile_id is required');
    }

    const { password } = await this.authService.resetPassword(caller!, {
      profileId: body.profile_id,
      expect: 'staff',
      password: body.password,
    });
    return new ApiResponse({ ok: true, password });
  }

  @ApiBearerAuth()
  @Roles('superadmin')
  @Post('staff')
  @ApiOperation({ summary: 'Create new staff member (Superadmin only)' })
  @SwaggerResponse({ status: 201, type: ApiResponse<{ ok: true; id: string; password: string }> })
  async createStaff(
    @CallerDecorator() caller: Caller | null,
    @Body() body: CreateStaffDto,
  ): Promise<ApiResponse<{ ok: true; id: string; password: string }>> {
    if (!body?.national_id || !body?.full_name) {
      throw badRequest('invalid_body', 'invalid staff payload');
    }

    const created = await this.authService.createStaff(caller!, {
      national_id: body.national_id,
      full_name: body.full_name,
      phone: body.phone,
      password: body.password,
      role: body.role ?? 'admin',
      assignments: body.assignments ?? [],
    });
    return new ApiResponse({ ok: true, id: created.id, password: created.password });
  }

  @ApiBearerAuth()
  @Roles('superadmin')
  @Delete('staff/:id')
  @ApiOperation({ summary: 'Delete staff account (Superadmin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteStaff(
    @CallerDecorator() caller: Caller | null,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.authService.deleteStaff(caller!, id);
    return new ApiResponse({ ok: true });
  }
}
