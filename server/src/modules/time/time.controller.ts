import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { TimeService } from './time.service.js';

export interface ServerNow {
  date: string;
  time: string;
  frozen?: boolean;
  real_date?: string;
  real_time?: string;
}

@Controller('api/v1/time')
export class TimeController {
  constructor(private readonly timeService: TimeService) {}

  @Public()
  @Get('now')
  async getNow(@CallerDecorator() caller: Caller | null): Promise<ServerNow> {
    return this.timeService.getNow(caller);
  }
}
