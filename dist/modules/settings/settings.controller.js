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
import { Controller, Get, Patch, Put, Body, Res } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
import { IndexPageService } from '../../infrastructure/web/index-page.service.js';
import { BRANDING_FALLBACK_ICON } from '../../infrastructure/web/index-page.constants.js';
let SettingsController = class SettingsController {
    settingsService;
    authService;
    indexPage;
    constructor(settingsService, authService, indexPage) {
        this.settingsService = settingsService;
        this.authService = authService;
        this.indexPage = indexPage;
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
    /**
     * The organisation's logo as an image, for the link preview.
     *
     * A preview crawler needs a plain image URL — it cannot read a data URL out
     * of a JSON body — so the logo Settings stores is decoded and served here.
     * The app's own icon stands in when there is none, so a shared link always
     * carries a picture. Public: the crawler has no token. Cached briefly, the
     * way IndexPageService remembers the name beside it.
     */
    async getBrandingLogo(reply) {
        const { logo } = await this.indexPage.publicBranding();
        const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(logo ?? '');
        // Headers are set and send() is called in ONE chain: a Fastify reply is a
        // thenable that resolves once the response is sent, so awaiting it any
        // earlier waits forever.
        reply.header('cache-control', 'public, max-age=300');
        if (m) {
            await reply.header('content-type', `image/${m[1]}`).send(Buffer.from(m[2], 'base64'));
            return;
        }
        const root = this.indexPage.clientDist;
        if (!root) {
            await reply.code(404).send();
            return;
        }
        await reply.header('content-type', 'image/png').send(readFileSync(join(root, BRANDING_FALLBACK_ICON)));
    }
    async updateSettings(body) {
        const data = await this.settingsService.updateSettings(body);
        // The link preview shows the name and logo; it must not show last hour's.
        this.indexPage.invalidate();
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
    Public(),
    Get('branding/logo.png'),
    ApiOperation({ summary: "The organisation's logo as a PNG/JPEG, or the app icon" }),
    __param(0, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getBrandingLogo", null);
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
        AuthService,
        IndexPageService])
], SettingsController);
export { SettingsController };
//# sourceMappingURL=settings.controller.js.map