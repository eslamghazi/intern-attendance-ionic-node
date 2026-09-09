import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { TimeService } from './time.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { ServerNowResponseDto } from './dto/time-response.dto.js';

@ApiTags('Time')
@Controller('api/v1/time')
export class TimeController {
  constructor(private readonly timeService: TimeService) {}

  @Public()
  @Get('now')
  @ApiOperation({ summary: 'Get current authoritative server time' })
  @SwaggerResponse({ status: 200, type: ApiResponse<ServerNowResponseDto> })
  async getNow(@CallerDecorator() caller: Caller | null): Promise<ApiResponse<ServerNowResponseDto>> {
    const data = await this.timeService.getNow(caller);
    return new ApiResponse(data);
  }
}
