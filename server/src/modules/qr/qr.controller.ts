import { Controller, Post, Body } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { badRequest } from '../../http/errors.js';
import { QrService } from './qr.service.js';

@Controller('api/v1/qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Post()
  async mintQr(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = z
      .object({
        branch_id: z.string().uuid().optional(),
        date: z.string().trim().min(1),
        member_id: z.string().uuid().nullish(),
      })
      .safeParse(body);
    if (!parsed.success) throw badRequest('missing', 'date is required');

    return this.qrService.mintQr(caller, parsed.data);
  }

  @Roles('member')
  @Post('redeem')
  async redeemQr(
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = z.object({ token: z.string().trim().min(1) }).safeParse(body);
    if (!parsed.success) throw badRequest('missing_token', 'token is required');

    return this.qrService.redeemQr(caller, parsed.data.token);
  }
}
