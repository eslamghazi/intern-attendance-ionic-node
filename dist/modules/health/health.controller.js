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
import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { pool } from '../../db/pool.js';
import { ApiResponse, ApiErrorResponse } from '../../common/dto/api-response.dto.js';
import { HealthResponseDto } from './dto/health-response.dto.js';
let HealthController = class HealthController {
    getHealth() {
        return new ApiResponse(new HealthResponseDto('ok'));
    }
    async getReady(res) {
        try {
            await pool.query('select 1');
            res.status(HttpStatus.OK);
            return new ApiResponse(new HealthResponseDto('ready', true));
        }
        catch {
            res.status(HttpStatus.SERVICE_UNAVAILABLE);
            return new ApiErrorResponse('service_unavailable', 'Database is not ready', { db: false });
        }
    }
    getApiHealth() {
        return this.getHealth();
    }
    async getApiReady(res) {
        return this.getReady(res);
    }
};
__decorate([
    Public(),
    Get('health'),
    ApiOperation({ summary: 'Liveness probe' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", ApiResponse)
], HealthController.prototype, "getHealth", null);
__decorate([
    Public(),
    Get('health/ready'),
    ApiOperation({ summary: 'Readiness probe' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getReady", null);
__decorate([
    Public(),
    Get('api/v1/health'),
    ApiOperation({ summary: 'API v1 liveness probe' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", ApiResponse)
], HealthController.prototype, "getApiHealth", null);
__decorate([
    Public(),
    Get('api/v1/health/ready'),
    ApiOperation({ summary: 'API v1 readiness probe' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "getApiReady", null);
HealthController = __decorate([
    ApiTags('Health'),
    Controller()
], HealthController);
export { HealthController };
//# sourceMappingURL=health.controller.js.map