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
import { Controller, Post, Get, Delete, Body, Param, Headers, } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import { AuthService } from './auth.service.js';
import { badRequest } from '../../http/errors.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { LoginDto, RefreshTokenDto, LogoutDto, ChangePasswordDto, InitialPasswordDto, ResetMemberPasswordDto, ResetStaffPasswordDto, CreateStaffDto, } from './dto/auth.dto.js';
import { AuthMapper } from './auth.mapper.js';
import { Role } from '../../common/enums/index.js';
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async login(body, userAgent) {
        if (!body?.national_id) {
            throw badRequest('invalid_body', 'national_id is required');
        }
        const result = await this.authService.login(body.national_id, body.password ?? '', userAgent ?? null);
        return new ApiResponse(AuthMapper.toLoginResultDto(result));
    }
    async refresh(body, userAgent) {
        if (!body?.refresh_token) {
            throw badRequest('invalid_body', 'refresh_token is required');
        }
        const result = await this.authService.refresh(body.refresh_token, userAgent ?? null);
        return new ApiResponse(AuthMapper.toLoginResultDto(result));
    }
    async logout(body) {
        await this.authService.logout(body?.refresh_token ?? null);
        return new ApiResponse({ ok: true });
    }
    async logoutAll(caller) {
        const { revoked } = await this.authService.logoutEverywhere(caller);
        return new ApiResponse({ ok: true, revoked });
    }
    async me(caller, _claims) {
        const data = await this.authService.getMe(caller);
        return new ApiResponse(data);
    }
    async changePassword(caller, body, userAgent) {
        if (!body?.current || !body?.new || body.new.length < 6) {
            throw badRequest('invalid_body', 'current is required and the new password must be 6+ chars');
        }
        const pair = await this.authService.changeOwnPassword(caller, body.current, body.new, userAgent ?? null);
        return new ApiResponse({ ok: true, ...pair });
    }
    async setInitialPassword(caller, body, userAgent) {
        if (!body?.new || body.new.length < 6) {
            throw badRequest('invalid_body', 'the new password must be 6+ chars');
        }
        const pair = await this.authService.setInitialPassword(caller, body.new, userAgent ?? null);
        return new ApiResponse({ ok: true, ...pair });
    }
    async resetMemberPassword(caller, body) {
        if (!body?.profile_id && !body?.national_id) {
            throw badRequest('invalid_body', 'profile_id or national_id is required');
        }
        const { password } = await this.authService.resetPassword(caller, {
            profileId: body.profile_id,
            nationalId: body.national_id,
            expect: 'member',
            password: body.password,
        });
        return new ApiResponse({ ok: true, password });
    }
    async resetStaffPassword(caller, body) {
        if (!body?.profile_id) {
            throw badRequest('invalid_body', 'profile_id is required');
        }
        const { password } = await this.authService.resetPassword(caller, {
            profileId: body.profile_id,
            expect: 'staff',
            password: body.password,
        });
        return new ApiResponse({ ok: true, password });
    }
    async createStaff(caller, body) {
        if (!body?.national_id || !body?.full_name) {
            throw badRequest('invalid_body', 'invalid staff payload');
        }
        const created = await this.authService.createStaff(caller, {
            national_id: body.national_id,
            full_name: body.full_name,
            phone: body.phone,
            password: body.password,
            role: body.role ?? Role.ADMIN,
            assignments: body.assignments ?? [],
        });
        return new ApiResponse({ ok: true, id: created.id, password: created.password });
    }
    async deleteStaff(caller, id) {
        await this.authService.deleteStaff(caller, id);
        return new ApiResponse({ ok: true });
    }
};
__decorate([
    Public(),
    Post('login'),
    ApiOperation({ summary: 'Sign in with national ID and password' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Body()),
    __param(1, Headers('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    Public(),
    Post('refresh'),
    ApiOperation({ summary: 'Renew access token using refresh token' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Body()),
    __param(1, Headers('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RefreshTokenDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    Public(),
    Post('logout'),
    ApiOperation({ summary: 'Invalidate current refresh token' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LogoutDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    ApiBearerAuth(),
    Post('logout-all'),
    ApiOperation({ summary: 'Invalidate all refresh tokens for caller' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logoutAll", null);
__decorate([
    ApiBearerAuth(),
    Get('me'),
    ApiOperation({ summary: 'Get current authenticated user profile' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, ClaimsDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    ApiBearerAuth(),
    Post('password'),
    ApiOperation({ summary: 'Change current user password' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __param(2, Headers('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ChangePasswordDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    ApiBearerAuth(),
    Post('password/initial'),
    ApiOperation({ summary: 'Set initial password for first-time login' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __param(2, Headers('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, InitialPasswordDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "setInitialPassword", null);
__decorate([
    ApiBearerAuth(),
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Post('members/reset-password'),
    ApiOperation({ summary: 'Reset a member password (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ResetMemberPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetMemberPassword", null);
__decorate([
    ApiBearerAuth(),
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Post('staff/reset-password'),
    ApiOperation({ summary: 'Reset a staff password (Admin/Superadmin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ResetStaffPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetStaffPassword", null);
__decorate([
    ApiBearerAuth(),
    Roles(Role.SUPERADMIN),
    Post('staff'),
    ApiOperation({ summary: 'Create new staff member (Superadmin only)' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateStaffDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "createStaff", null);
__decorate([
    ApiBearerAuth(),
    Roles(Role.SUPERADMIN),
    Delete('staff/:id'),
    ApiOperation({ summary: 'Delete staff account (Superadmin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "deleteStaff", null);
AuthController = __decorate([
    ApiTags('Auth'),
    Controller('api/v1/auth'),
    __metadata("design:paramtypes", [AuthService])
], AuthController);
export { AuthController };
//# sourceMappingURL=auth.controller.js.map