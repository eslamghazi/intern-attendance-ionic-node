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
import { Controller, Get, Post, Patch, Delete, Body, Param, } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CatalogService } from './catalog.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { CreateInstitutionDto, UpdateInstitutionDto, CreateBranchDto, UpdateBranchDto, CreateGroupDto, UpdateGroupDto, CreateShiftDto, UpdateShiftDto, } from './dto/catalog.dto.js';
import { Role } from '../../common/enums/index.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
let CatalogController = class CatalogController {
    catalogService;
    constructor(catalogService) {
        this.catalogService = catalogService;
    }
    /* Institutions */
    async getInstitutions() {
        const data = await this.catalogService.getInstitutions();
        return new ApiResponse(data);
    }
    async createInstitution(body) {
        const data = await this.catalogService.createInstitution(body);
        return new ApiResponse(data);
    }
    async updateInstitution(id, body) {
        const data = await this.catalogService.updateInstitution(id, body);
        return new ApiResponse(data);
    }
    async deleteInstitution(id) {
        await this.catalogService.deleteInstitution(id);
        return new ApiResponse({ ok: true });
    }
    /* Branches */
    async getBranches() {
        const data = await this.catalogService.getBranches();
        return new ApiResponse(data);
    }
    async getBranchesOptions(caller) {
        const data = await this.catalogService.getBranchesOptions(caller);
        return new ApiResponse(data);
    }
    async createBranch(body) {
        const data = await this.catalogService.createBranch(body);
        return new ApiResponse(data);
    }
    async updateBranch(id, body) {
        const data = await this.catalogService.updateBranch(id, body);
        return new ApiResponse(data);
    }
    async deleteBranch(id) {
        await this.catalogService.deleteBranch(id);
        return new ApiResponse({ ok: true });
    }
    /* Groups */
    async getGroups() {
        const data = await this.catalogService.getGroups();
        return new ApiResponse(data);
    }
    async getGroupsOptions(caller) {
        const data = await this.catalogService.getGroupsOptions(caller);
        return new ApiResponse(data);
    }
    async createGroup(body) {
        const data = await this.catalogService.createGroup(body);
        return new ApiResponse(data);
    }
    async updateGroup(id, body) {
        const data = await this.catalogService.updateGroup(id, body);
        return new ApiResponse(data);
    }
    async deleteGroup(id) {
        await this.catalogService.deleteGroup(id);
        return new ApiResponse({ ok: true });
    }
    /* Shifts */
    async getShifts() {
        const data = await this.catalogService.getShifts();
        return new ApiResponse(data);
    }
    async getShiftsKeys() {
        const data = await this.catalogService.getShiftsKeys();
        return new ApiResponse(data);
    }
    async createShift(body) {
        const data = await this.catalogService.createShift(body);
        return new ApiResponse(data);
    }
    async updateShift(id, body) {
        const data = await this.catalogService.updateShift(id, body);
        return new ApiResponse(data);
    }
    async deleteShift(id) {
        await this.catalogService.deleteShift(id);
        return new ApiResponse({ ok: true });
    }
};
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Get('institutions'),
    ApiOperation({ summary: 'Get all institutions' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getInstitutions", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Post('institutions'),
    ApiOperation({ summary: 'Create an institution' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateInstitutionDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "createInstitution", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Patch('institutions/:id'),
    ApiOperation({ summary: 'Update an institution' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateInstitutionDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "updateInstitution", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Delete('institutions/:id'),
    ApiOperation({ summary: 'Delete an institution' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "deleteInstitution", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Get('branches'),
    ApiOperation({ summary: 'Get all branches' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getBranches", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Get('branches/options'),
    ApiOperation({ summary: 'Get lightweight branch options for dropdowns' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getBranchesOptions", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Post('branches'),
    ApiOperation({ summary: 'Create a branch with geofence settings' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateBranchDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "createBranch", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Patch('branches/:id'),
    ApiOperation({ summary: 'Update a branch' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateBranchDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "updateBranch", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Delete('branches/:id'),
    ApiOperation({ summary: 'Delete a branch' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "deleteBranch", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Get('groups'),
    ApiOperation({ summary: 'Get all groups' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getGroups", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Get('groups/options'),
    ApiOperation({ summary: 'Get lightweight group options for dropdowns' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getGroupsOptions", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Post('groups'),
    ApiOperation({ summary: 'Create a group' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateGroupDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "createGroup", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Patch('groups/:id'),
    ApiOperation({ summary: 'Update a group' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateGroupDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "updateGroup", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Delete('groups/:id'),
    ApiOperation({ summary: 'Delete a group' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "deleteGroup", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Get('shifts'),
    ApiOperation({ summary: 'Get all shifts' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getShifts", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Get('shifts/keys'),
    ApiOperation({ summary: 'Get shift keys list' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getShiftsKeys", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Post('shifts'),
    ApiOperation({ summary: 'Create a shift' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateShiftDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "createShift", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Patch('shifts/:id'),
    ApiOperation({ summary: 'Update a shift' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateShiftDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "updateShift", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Delete('shifts/:id'),
    ApiOperation({ summary: 'Delete a shift' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "deleteShift", null);
CatalogController = __decorate([
    ApiTags('Catalog'),
    ApiBearerAuth(),
    Controller('api/v1'),
    __metadata("design:paramtypes", [CatalogService])
], CatalogController);
export { CatalogController };
//# sourceMappingURL=catalog.controller.js.map