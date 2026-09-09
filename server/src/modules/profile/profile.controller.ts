import { Controller, Post, Patch, Get, Body } from '@nestjs/common';
import { z } from 'zod';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import type { JwtClaims } from '../../db/context.js';
import { ProfileService } from './profile.service.js';
import { badRequest } from '../../http/errors.js';

const updateBody = z.object({
  full_name: z.string().trim().min(1),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  national_id: z.string().trim(),
  avatar_url: z.string().nullish(),
});

@Controller('api/v1/profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post('mark-enrolled')
  async markEnrolled(@CallerDecorator() caller: Caller) {
    await this.profileService.markEnrolled(caller);
    return { ok: true };
  }

  @Post('mark-password-changed')
  async markPasswordChanged(@CallerDecorator() caller: Caller) {
    await this.profileService.markPasswordChanged(caller);
    return { ok: true };
  }

  @Patch('me')
  async updateMe(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = updateBody.safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid profile payload');
    const p = parsed.data;
    await this.profileService.updateOwnProfile(caller, {
      fullName: p.full_name,
      phone: p.phone ?? '',
      email: p.email ?? '',
      nationalId: p.national_id,
      avatarUrl: p.avatar_url ?? null,
    });
    return { ok: true };
  }

  @Get('member-code')
  async getMemberCode(
    @CallerDecorator() caller: Caller,
    @ClaimsDecorator() claims: JwtClaims,
  ) {
    return this.profileService.getMemberCode(claims, caller.id);
  }
}
