import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { badRequest } from '../../http/errors.js';
import { QrService } from './qr.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { MintQrDto, RedeemQrDto, MintQrResponseDto, RedeemQrResponseDto } from './dto/qr.dto.js';
import { QrMapper } from './qr.mapper.js';
import { Role } from '../../common/enums/index.js';

@ApiTags('QR')
@ApiBearerAuth()
@Controller('api/v1/qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Post()
  @ApiOperation({ summary: 'Mint a new time-limited QR token' })
  @SwaggerResponse({ status: 201, type: ApiResponse<MintQrResponseDto> })
  async mintQr(
    @CallerDecorator() caller: Caller | null,
    @Body() body: MintQrDto,
  ): Promise<ApiResponse<MintQrResponseDto>> {
    if (!body?.date) throw badRequest('invalid_body', 'date is required');

    const data = await this.qrService.mintQr(caller!, {
      branch_id: body.branch_id,
      date: body.date,
      member_id: body.member_id ?? null,
    });
    return new ApiResponse(QrMapper.toMintResponse(data));
  }

  @Roles(Role.MEMBER)
  @Post('redeem')
  @ApiOperation({ summary: 'Redeem a QR code to unlock location bypass for check-in' })
  @SwaggerResponse({ status: 200, type: ApiResponse<RedeemQrResponseDto> })
  async redeemQr(
    @CallerDecorator() caller: Caller | null,
    @Body() body: RedeemQrDto,
  ): Promise<ApiResponse<RedeemQrResponseDto>> {
    if (!body?.token) throw badRequest('invalid_body', 'token is required');

    const data = await this.qrService.redeemQr(caller!, body.token);
    return new ApiResponse(QrMapper.toRedeemResponse(data));
  }
}
