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
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Page } from '../../common/decorators/page.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import { badRequest } from '../../common/errors.js';
import { PresenceService } from './presence.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { CreatePresenceCheckDto, ConfirmPresenceByAdminDto, ResolvePresenceCheckDto, ConfirmPresenceByMemberDto, } from './dto/presence.dto.js';
import { PresenceMapper } from './presence.mapper.js';
import { Role } from '../../common/enums/index.js';
let PresenceController = class PresenceController {
    presenceService;
    constructor(presenceService) {
        this.presenceService = presenceService;
    }
    async createCheck(caller, body) {
        const data = await this.presenceService.createCheck(caller, {
            branch_id: body?.branch_id,
            group_id: body?.group_id,
            department_id: body?.department_id,
            shift_id: body?.shift_id,
            deadline_minutes: body?.deadline_minutes ?? 10,
        });
        return new ApiResponse(PresenceMapper.toCreateCheckResponse(data));
    }
    async getChecks(caller) {
        const data = await this.presenceService.getChecks(caller.id);
        return new ApiResponse(data);
    }
    async deleteCheck(caller, id) {
        await this.presenceService.deleteCheck(caller.id, id);
        return new ApiResponse({ ok: true });
    }
    async confirmByAdmin(caller, id, body) {
        if (!body?.member_id)
            throw badRequest('invalid_body', 'member_id is required');
        const data = await this.presenceService.confirmByAdmin(caller.id, id, body.member_id);
        return new ApiResponse(data);
    }
    async resolveCheck(caller, id, body) {
        const data = await this.presenceService.resolveCheck(caller.id, id, body?.decision ?? 'keep');
        return new ApiResponse(data);
    }
    async getPending(caller) {
        const data = await this.presenceService.getPending(caller.id);
        return new ApiResponse(data);
    }
    async confirmByMember(caller, body) {
        if (!body?.check_id)
            throw badRequest('invalid_body', 'check_id is required');
        const data = await this.presenceService.confirmByMember(caller.id, body.check_id);
        return new ApiResponse(data);
    }
};
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('presence', 'create'),
    Post('checks'),
    ApiOperation({ summary: 'Create a new spot-check verification session (Admin only)' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreatePresenceCheckDto]),
    __metadata("design:returntype", Promise)
], PresenceController.prototype, "createCheck", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('presence'),
    Get('checks'),
    ApiOperation({ summary: 'Get active and recent spot-checks created by admin' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PresenceController.prototype, "getChecks", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('presence', 'delete'),
    Delete('checks/:id'),
    ApiOperation({ summary: 'Cancel or delete an active spot-check session' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PresenceController.prototype, "deleteCheck", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Page('presence', 'edit'),
    Post('checks/:id/confirm'),
    ApiOperation({ summary: 'Manually confirm a member presence during a spot-check (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ConfirmPresenceByAdminDto]),
    __metadata("design:returntype", Promise)
], PresenceController.prototype, "confirmByAdmin", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Page('presence', 'edit'),
    Post('checks/:id/resolve'),
    ApiOperation({ summary: 'Resolve an expired or completed spot-check' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ResolvePresenceCheckDto]),
    __metadata("design:returntype", Promise)
], PresenceController.prototype, "resolveCheck", null);
__decorate([
    Roles(Role.MEMBER),
    Get('pending'),
    ApiOperation({ summary: 'Check if caller has pending spot-checks needing confirmation' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PresenceController.prototype, "getPending", null);
__decorate([
    Roles(Role.MEMBER),
    HttpCode(HttpStatus.OK),
    Post('confirm'),
    ApiOperation({ summary: 'Confirm presence for a spot-check (Member self-report)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ConfirmPresenceByMemberDto]),
    __metadata("design:returntype", Promise)
], PresenceController.prototype, "confirmByMember", null);
PresenceController = __decorate([
    ApiTags('Presence'),
    ApiBearerAuth(),
    Controller('api/v1/presence'),
    __metadata("design:paramtypes", [PresenceService])
], PresenceController);
export { PresenceController };
//# sourceMappingURL=presence.controller.js.map