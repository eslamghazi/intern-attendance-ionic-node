import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
} from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import type { JwtClaims } from '../../db/context.js';
import { badRequest } from '../../http/errors.js';
import { FaceService } from './face.service.js';

@Controller('api/v1/face')
export class FaceController {
  constructor(private readonly faceService: FaceService) {}

  @Roles('member')
  @Post('enroll-photo')
  async enrollPhoto(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = z.object({ image_base64: z.string() }).safeParse(body);
    if (!parsed.success) throw badRequest('missing_image', 'image_base64 is required');

    return this.faceService.enrollPhoto(caller, parsed.data.image_base64);
  }

  @Roles('admin', 'superadmin')
  @Post('reset')
  async resetFace(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = z.object({ member_id: z.string().uuid() }).safeParse(body);
    if (!parsed.success) throw badRequest('missing', 'member_id is required');

    return this.faceService.resetFace(caller, parsed.data.member_id);
  }

  @Post('lookup')
  async lookup(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = z.object({ code: z.string().trim().min(1) }).safeParse(body);
    if (!parsed.success) throw badRequest('missing', 'code is required');

    return this.faceService.lookup(caller, parsed.data.code);
  }

  @Get('templates/:memberId')
  async getTemplate(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('memberId') memberId: string,
  ) {
    return this.faceService.getTemplate(claims, memberId);
  }

  @Put('templates/:memberId')
  async putTemplate(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('memberId') memberId: string,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({
        embedding: z.string().min(3),
        photo_path: z.string().nullish(),
        quality_score: z.number().nullish(),
      })
      .safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid template payload');

    return this.faceService.putTemplate(claims, memberId, parsed.data);
  }

  @Post('templates/photos')
  async getTemplatePhotos(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: unknown,
  ) {
    const parsed = z.object({ member_ids: z.array(z.string().uuid()) }).safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'member_ids is required');

    return this.faceService.getTemplatePhotos(claims, parsed.data.member_ids);
  }

  @Roles('admin', 'superadmin')
  @Get('templates/photo-paths')
  async getTemplatePhotoPaths(@ClaimsDecorator() claims: JwtClaims) {
    return this.faceService.getTemplatePhotoPaths(claims);
  }

  @Post('tool-reset')
  async toolReset(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = z.object({ member_id: z.string().uuid() }).safeParse(body);
    if (!parsed.success) throw badRequest('missing', 'member_id is required');

    return this.faceService.toolReset(caller, parsed.data.member_id);
  }
}
