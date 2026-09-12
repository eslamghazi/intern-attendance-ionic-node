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
import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/index.js';
import { ProfileService } from './profile.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { UpdateProfileDto } from './dto/profile.dto.js';
let ProfileController = class ProfileController {
    profileService;
    constructor(profileService) {
        this.profileService = profileService;
    }
    async markEnrolled(caller) {
        await this.profileService.markEnrolled(caller);
        return new ApiResponse({ ok: true });
    }
    async updateMe(caller, body) {
        await this.profileService.updateOwnProfile(caller, {
            fullName: body.full_name,
            phone: body.phone ?? '',
            email: body.email ?? '',
            nationalId: body.national_id,
            avatarUrl: body.avatar_url ?? null,
        });
        return new ApiResponse({ ok: true });
    }
    async getMemberCode(caller) {
        const data = await this.profileService.getMemberCode(caller.id);
        return new ApiResponse(data);
    }
};
__decorate([
    Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Post('mark-enrolled'),
    ApiOperation({ summary: 'Mark caller as biometric face enrolled' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "markEnrolled", null);
__decorate([
    Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN),
    Patch('me'),
    ApiOperation({ summary: 'Update caller own profile info' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, UpdateProfileDto]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "updateMe", null);
__decorate([
    Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN),
    Get('member-code'),
    ApiOperation({ summary: 'Get caller member numeric code' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProfileController.prototype, "getMemberCode", null);
ProfileController = __decorate([
    ApiTags('Profile'),
    ApiBearerAuth(),
    Controller('api/v1/profile'),
    __metadata("design:paramtypes", [ProfileService])
], ProfileController);
export { ProfileController };
//# sourceMappingURL=profile.controller.js.map