import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/index.js';
import type { Caller } from '../../common/types.js';
import { ProfileService } from './profile.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { UpdateProfileDto, MemberCodeResponseDto } from './dto/profile.dto.js';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('api/v1/profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @Post('mark-enrolled')
  @ApiOperation({ summary: 'Mark caller as biometric face enrolled' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async markEnrolled(@CallerDecorator() caller: Caller | null): Promise<ApiResponse<{ ok: true }>> {
    await this.profileService.markEnrolled(caller!);
    return new ApiResponse({ ok: true });
  }

  @Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN)
  @Patch('me')
  @ApiOperation({ summary: 'Update caller own profile info' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async updateMe(
    @CallerDecorator() caller: Caller | null,
    @Body() body: UpdateProfileDto,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.profileService.updateOwnProfile(caller!, {
      fullName: body.full_name,
      phone: body.phone ?? '',
      email: body.email ?? '',
      nationalId: body.national_id,
      avatarUrl: body.avatar_url ?? null,
    });
    return new ApiResponse({ ok: true });
  }

  @Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN)
  @Get('member-code')
  @ApiOperation({ summary: 'Get caller member numeric code' })
  @SwaggerResponse({ status: 200, type: ApiResponse<MemberCodeResponseDto> })
  async getMemberCode(
    @CallerDecorator() caller: Caller | null,
  ): Promise<ApiResponse<MemberCodeResponseDto>> {
    const data = await this.profileService.getMemberCode(caller!.id);
    return new ApiResponse(data);
  }
}
