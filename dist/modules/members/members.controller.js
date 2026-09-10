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
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import { MembersService } from './members.service.js';
import { ApiResponse, PaginatedResponse } from '../../common/dto/api-response.dto.js';
import { CreateMembersBatchDto, UpdateMemberDto, MemberFilterQueryDto, BulkFlagDto, BulkFrozenDto, BulkUpdateDto, BulkDeleteDto, } from './dto/member.dto.js';
import { Role } from '../../common/enums/index.js';
let MembersController = class MembersController {
    membersService;
    constructor(membersService) {
        this.membersService = membersService;
    }
    async createMembers(caller, body) {
        const data = await this.membersService.createMembers(caller, body.members);
        return new ApiResponse(data);
    }
    async getNationalIds(claims) {
        const data = await this.membersService.getNationalIds(claims);
        return new ApiResponse(data);
    }
    async getMembers(claims, query) {
        const { page = 1, page_size: pageSize = 50, ...filters } = query;
        const offset = (page - 1) * pageSize;
        const result = await this.membersService.getMembers(claims, filters, pageSize, offset);
        return new PaginatedResponse(result.rows, result.total, { page, pageSize });
    }
    async getMembersPage(claims, query) {
        const { page = 1, page_size: pageSize = 50, ...filters } = query;
        const offset = (page - 1) * pageSize;
        const result = await this.membersService.getMembersPage(claims, filters, pageSize, offset);
        return new PaginatedResponse(result.items, result.total, { page, pageSize });
    }
    async getFlagStats(claims, query) {
        const data = await this.membersService.getFlagStats(claims, query);
        return new ApiResponse(data);
    }
    async getCountActive(claims) {
        const data = await this.membersService.getCountActive(claims);
        return new ApiResponse(data);
    }
    async getByProfile(claims, profileId) {
        const data = await this.membersService.getByProfile(claims, profileId);
        return new ApiResponse(data);
    }
    async updateMember(claims, id, body) {
        const data = await this.membersService.updateMember(claims, id, body);
        return new ApiResponse(data);
    }
    async deleteByProfile(caller, claims, profileId) {
        await this.membersService.deleteByProfile(caller, claims, profileId);
        return new ApiResponse({ ok: true });
    }
    async bulkFlag(claims, body) {
        const { flag, value, ...filters } = body;
        const data = await this.membersService.bulkUpdate(claims, filters, { [flag]: value });
        return new ApiResponse(data);
    }
    async bulkFrozen(claims, body) {
        const { frozen_at: frozenAt, ...filters } = body;
        const data = await this.membersService.bulkUpdate(claims, filters, { frozen_at: frozenAt });
        return new ApiResponse(data);
    }
    async bulkUpdatePost(claims, body) {
        const { group_id: groupId, branch_id: branchId, is_active: isActive, ...filters } = body;
        const patch = {};
        if (groupId)
            patch.group_id = groupId;
        if (branchId)
            patch.branch_id = branchId;
        if (isActive !== undefined)
            patch.is_active = isActive;
        const data = await this.membersService.bulkUpdate(claims, filters, patch);
        return new ApiResponse(data);
    }
    async bulkDelete(claims, body) {
        const data = await this.membersService.bulkDelete(claims, body);
        return new ApiResponse(data);
    }
};
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Post(),
    ApiOperation({ summary: 'Create member or batch of members' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateMembersBatchDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "createMembers", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Get('national-ids'),
    ApiOperation({ summary: 'Get list of existing member national IDs' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getNationalIds", null);
__decorate([
    Get(),
    ApiOperation({ summary: 'List members with optional filters' }),
    SwaggerResponse({ status: 200, type: (PaginatedResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberFilterQueryDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getMembers", null);
__decorate([
    Get('page'),
    ApiOperation({ summary: 'Paginated members list' }),
    SwaggerResponse({ status: 200, type: (PaginatedResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberFilterQueryDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getMembersPage", null);
__decorate([
    Get('flag-stats'),
    ApiOperation({ summary: 'Get summary statistics of flagged members' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MemberFilterQueryDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getFlagStats", null);
__decorate([
    Get('count-active'),
    ApiOperation({ summary: 'Count active members' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getCountActive", null);
__decorate([
    Get('by-profile/:profileId'),
    ApiOperation({ summary: 'Get member details by profile ID' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Param('profileId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getByProfile", null);
__decorate([
    Patch(':id'),
    ApiOperation({ summary: 'Update a member profile and attendance rules' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateMemberDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "updateMember", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Delete('by-profile/:profileId'),
    ApiOperation({ summary: 'Delete a member by profile ID' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, ClaimsDecorator()),
    __param(2, Param('profileId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "deleteByProfile", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Post('bulk/flag'),
    ApiOperation({ summary: 'Bulk update a boolean flag across members' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, BulkFlagDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "bulkFlag", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Post('bulk/frozen'),
    ApiOperation({ summary: 'Bulk update frozen date across members' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, BulkFrozenDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "bulkFrozen", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Post('bulk/update'),
    ApiOperation({ summary: 'Bulk update members assignments or active status' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, BulkUpdateDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "bulkUpdatePost", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Post('bulk/delete'),
    ApiOperation({ summary: 'Bulk delete members matching filter criteria' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, BulkDeleteDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "bulkDelete", null);
MembersController = __decorate([
    ApiTags('Members'),
    ApiBearerAuth(),
    Controller('api/v1/members'),
    __metadata("design:paramtypes", [MembersService])
], MembersController);
export { MembersController };
//# sourceMappingURL=members.controller.js.map