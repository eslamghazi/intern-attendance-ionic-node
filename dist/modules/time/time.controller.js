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
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import { TimeService } from './time.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
let TimeController = class TimeController {
    timeService;
    constructor(timeService) {
        this.timeService = timeService;
    }
    async getNow(caller) {
        const data = await this.timeService.getNow(caller);
        return new ApiResponse(data);
    }
};
__decorate([
    Public(),
    Get('now'),
    ApiOperation({ summary: 'Get current authoritative server time' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TimeController.prototype, "getNow", null);
TimeController = __decorate([
    ApiTags('Time'),
    Controller('api/v1/time'),
    __metadata("design:paramtypes", [TimeService])
], TimeController);
export { TimeController };
//# sourceMappingURL=time.controller.js.map