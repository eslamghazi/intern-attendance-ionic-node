var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import { badRequest } from '../../http/errors.js';
import { QrService } from './qr.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { MintQrDto, RedeemQrDto } from './dto/qr.dto.js';
import { QrMapper } from './qr.mapper.js';
import { Role } from '../../common/enums/index.js';
let QrController = class QrController {
    qrService;
    constructor(qrService) {
        this.qrService = qrService;
    }
    async mintQr(caller, body) {
        if (!body?.date)
            throw badRequest('invalid_body', 'date is required');
        const data = await this.qrService.mintQr(caller, {
            branch_id: body.branch_id,
            date: body.date,
            member_id: body.member_id ?? null,
        });
        return new ApiResponse(QrMapper.toMintResponse(data));
    }
    async redeemQr(caller, body) {
        if (!body?.token)
            throw badRequest('invalid_body', 'token is required');
        const data = await this.qrService.redeemQr(caller, body.token);
        return new ApiResponse(QrMapper.toRedeemResponse(data));
    }
};
__decorate([
    Post(),
    ApiOperation({ summary: 'Mint a new time-limited QR token' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MintQrDto]),
    __metadata("design:returntype", Promise)
], QrController.prototype, "mintQr", null);
__decorate([
    Roles(Role.MEMBER),
    Post('redeem'),
    ApiOperation({ summary: 'Redeem a QR code to unlock location bypass for check-in' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, RedeemQrDto]),
    __metadata("design:returntype", Promise)
], QrController.prototype, "redeemQr", null);
QrController = __decorate([
    ApiTags('QR'),
    ApiBearerAuth(),
    Controller('api/v1/qr'),
    __metadata("design:paramtypes", [QrService])
], QrController);
export { QrController };
//# sourceMappingURL=qr.controller.js.map