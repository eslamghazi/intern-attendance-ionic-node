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
import { Controller, Get, Patch, Post, Delete, Body, Param, } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Page } from '../../common/decorators/page.decorator.js';
import { Caller as CallerDecorator, } from '../../common/decorators/caller.decorator.js';
import { AdminsService } from './admins.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { UpdateAdminDto, CreateAdminAssignmentDto, } from './dto/admin.dto.js';
import { Role } from '../../common/enums/index.js';
let AdminsController = class AdminsController {
    adminsService;
    constructor(adminsService) {
        this.adminsService = adminsService;
    }
    async getAdmins(caller) {
        const data = await this.adminsService.getAdmins(caller);
        return new ApiResponse(data);
    }
    async getAssignments() {
        const data = await this.adminsService.getAssignments();
        return new ApiResponse(data);
    }
    async updateAdmin(id, body) {
        const data = await this.adminsService.updateAdmin(id, body);
        return new ApiResponse(data);
    }
    async createAssignment(body) {
        const data = await this.adminsService.createAssignment(body.admin_id, body.group_id ?? null, body.branch_id ?? null);
        return new ApiResponse(data);
    }
    async deleteAssignment(id) {
        await this.adminsService.deleteAssignment(id);
        return new ApiResponse({ ok: true });
    }
};
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('admins'),
    Get(),
    ApiOperation({ summary: 'Get every staff account but the caller (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminsController.prototype, "getAdmins", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('admins'),
    Get('assignments'),
    ApiOperation({ summary: 'Get all admin branch/group assignments (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminsController.prototype, "getAssignments", null);
__decorate([
    Roles(Role.SUPERADMIN),
    Patch(':id'),
    ApiOperation({ summary: 'Update admin profile and permissions (Superadmin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateAdminDto]),
    __metadata("design:returntype", Promise)
], AdminsController.prototype, "updateAdmin", null);
__decorate([
    Roles(Role.SUPERADMIN),
    Post('assignments'),
    ApiOperation({ summary: 'Assign admin to branch or group (Superadmin only)' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateAdminAssignmentDto]),
    __metadata("design:returntype", Promise)
], AdminsController.prototype, "createAssignment", null);
__decorate([
    Roles(Role.SUPERADMIN),
    Delete('assignments/:id'),
    ApiOperation({ summary: 'Delete admin assignment (Superadmin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminsController.prototype, "deleteAssignment", null);
AdminsController = __decorate([
    ApiTags('Admins'),
    ApiBearerAuth(),
    Controller('api/v1/admins'),
    __metadata("design:paramtypes", [AdminsService])
], AdminsController);
export { AdminsController };
//# sourceMappingURL=admins.controller.js.map