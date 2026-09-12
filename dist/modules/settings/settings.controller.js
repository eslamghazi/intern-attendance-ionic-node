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
import { Controller, Get, Patch, Put, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Page } from '../../common/decorators/page.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import { AuthService } from '../auth/auth.service.js';
import { SettingsService } from './settings.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { UpdateSettingsDto, MasterPasswordStatusResponseDto, SetMasterPasswordDto, } from './dto/settings.dto.js';
import { Role } from '../../common/enums/index.js';
let SettingsController = class SettingsController {
    settingsService;
    authService;
    constructor(settingsService, authService) {
        this.settingsService = settingsService;
        this.authService = authService;
    }
    async getSettings(caller) {
        if (!caller)
            return new ApiResponse(null);
        const data = await this.settingsService.getSettings();
        return new ApiResponse(data);
    }
    async getBranding() {
        const data = await this.settingsService.getBranding();
        return new ApiResponse(data);
    }
    async updateSettings(body) {
        const data = await this.settingsService.updateSettings(body);
        return new ApiResponse(data);
    }
    async getMasterPassword() {
        const configured = await this.authService.masterPasswordIsSet();
        return new ApiResponse(new MasterPasswordStatusResponseDto(configured));
    }
    async setMasterPassword(body) {
        await this.authService.setMasterPassword(body.password);
        return new ApiResponse({ ok: true });
    }
};
__decorate([
    Public(),
    Get(),
    ApiOperation({ summary: 'Get application settings' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getSettings", null);
__decorate([
    Public(),
    Get('branding'),
    ApiOperation({ summary: 'Get public branding settings' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getBranding", null);
__decorate([
    ApiBearerAuth(),
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Page('settings', 'edit'),
    Patch(),
    ApiOperation({ summary: 'Update system settings (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpdateSettingsDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateSettings", null);
__decorate([
    ApiBearerAuth(),
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Page('settings'),
    Get('master-password'),
    ApiOperation({ summary: 'Check if master password is configured' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getMasterPassword", null);
__decorate([
    ApiBearerAuth(),
    Roles(Role.SUPERADMIN),
    Put('master-password'),
    ApiOperation({ summary: 'Set or change master password (Superadmin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SetMasterPasswordDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "setMasterPassword", null);
SettingsController = __decorate([
    ApiTags('Settings'),
    Controller('api/v1/settings'),
    __metadata("design:paramtypes", [SettingsService,
        AuthService])
], SettingsController);
export { SettingsController };
//# sourceMappingURL=settings.controller.js.map