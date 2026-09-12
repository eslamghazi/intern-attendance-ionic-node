import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { Public } from '../../common/decorators/public.decorator.js';
import { HealthRepository } from './health.repository.js';
import { ApiResponse, ApiErrorResponse } from '../../common/dto/api-response.dto.js';
import { HealthResponseDto } from './dto/health-response.dto.js';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly health: HealthRepository) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  @SwaggerResponse({ status: 200, type: ApiResponse<HealthResponseDto> })
  getHealth(): ApiResponse<HealthResponseDto> {
    return new ApiResponse(new HealthResponseDto('ok'));
  }

  @Public()
  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @SwaggerResponse({ status: 200, type: ApiResponse<HealthResponseDto> })
  async getReady(@Res({ passthrough: true }) res: FastifyReply): Promise<ApiResponse<HealthResponseDto> | ApiErrorResponse> {
    try {
      if (!(await this.health.isReady())) {
        // Reachable, but the schema is not there — see HealthRepository. Not
        // ready is the honest answer, and it keeps an unmigrated instance out
        // of the load balancer instead of letting it fail every request.
        res.status(HttpStatus.SERVICE_UNAVAILABLE);
        return new ApiErrorResponse('service_unavailable', 'Database is not migrated', { db: false });
      }
      res.status(HttpStatus.OK);
      return new ApiResponse(new HealthResponseDto('ready', true));
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return new ApiErrorResponse('service_unavailable', 'Database is not ready', { db: false });
    }
  }

  @Public()
  @Get('api/v1/health')
  @ApiOperation({ summary: 'API v1 liveness probe' })
  @SwaggerResponse({ status: 200, type: ApiResponse<HealthResponseDto> })
  getApiHealth(): ApiResponse<HealthResponseDto> {
    return this.getHealth();
  }

  @Public()
  @Get('api/v1/health/ready')
  @ApiOperation({ summary: 'API v1 readiness probe' })
  @SwaggerResponse({ status: 200, type: ApiResponse<HealthResponseDto> })
  async getApiReady(@Res({ passthrough: true }) res: FastifyReply): Promise<ApiResponse<HealthResponseDto> | ApiErrorResponse> {
    return this.getReady(res);
  }
}
