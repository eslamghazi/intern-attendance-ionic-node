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
import { Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import { CatalogService } from './catalog.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { CreateInstitutionDto, UpdateInstitutionDto, CreateBranchDto, UpdateBranchDto, CreateGroupDto, UpdateGroupDto, CreateShiftDto, UpdateShiftDto, } from './dto/catalog.dto.js';
import { Role } from '../../common/enums/index.js';
let CatalogController = class CatalogController {
    catalogService;
    constructor(catalogService) {
        this.catalogService = catalogService;
    }
    /* Institutions */
    async getInstitutions(claims) {
        const data = await this.catalogService.getInstitutions(claims);
        return new ApiResponse(data);
    }
    async createInstitution(claims, body) {
        const data = await this.catalogService.createInstitution(claims, body);
        return new ApiResponse(data);
    }
    async updateInstitution(claims, id, body) {
        const data = await this.catalogService.updateInstitution(claims, id, body);
        return new ApiResponse(data);
    }
    async deleteInstitution(claims, id) {
        await this.catalogService.deleteInstitution(claims, id);
        return new ApiResponse({ ok: true });
    }
    /* Branches */
    async getBranches(claims) {
        const data = await this.catalogService.getBranches(claims);
        return new ApiResponse(data);
    }
    async getBranchesOptions(claims) {
        const data = await this.catalogService.getBranchesOptions(claims);
        return new ApiResponse(data);
    }
    async createBranch(claims, body) {
        const data = await this.catalogService.createBranch(claims, body);
        return new ApiResponse(data);
    }
    async updateBranch(claims, id, body) {
        const data = await this.catalogService.updateBranch(claims, id, body);
        return new ApiResponse(data);
    }
    async deleteBranch(claims, id) {
        await this.catalogService.deleteBranch(claims, id);
        return new ApiResponse({ ok: true });
    }
    /* Groups */
    async getGroups(claims) {
        const data = await this.catalogService.getGroups(claims);
        return new ApiResponse(data);
    }
    async getGroupsOptions(claims) {
        const data = await this.catalogService.getGroupsOptions(claims);
        return new ApiResponse(data);
    }
    async createGroup(claims, body) {
        const data = await this.catalogService.createGroup(claims, body);
        return new ApiResponse(data);
    }
    async updateGroup(claims, id, body) {
        const data = await this.catalogService.updateGroup(claims, id, body);
        return new ApiResponse(data);
    }
    async deleteGroup(claims, id) {
        await this.catalogService.deleteGroup(claims, id);
        return new ApiResponse({ ok: true });
    }
    /* Shifts */
    async getShifts(claims) {
        const data = await this.catalogService.getShifts(claims);
        return new ApiResponse(data);
    }
    async getShiftsKeys(claims) {
        const data = await this.catalogService.getShiftsKeys(claims);
        return new ApiResponse(data);
    }
    async createShift(claims, body) {
        const data = await this.catalogService.createShift(claims, body);
        return new ApiResponse(data);
    }
    async updateShift(claims, id, body) {
        const data = await this.catalogService.updateShift(claims, id, body);
        return new ApiResponse(data);
    }
    async deleteShift(claims, id) {
        await this.catalogService.deleteShift(claims, id);
        return new ApiResponse({ ok: true });
    }
};
__decorate([
    Get('institutions'),
    ApiOperation({ summary: 'Get all institutions' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getInstitutions", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Post('institutions'),
    ApiOperation({ summary: 'Create an institution' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateInstitutionDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "createInstitution", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Patch('institutions/:id'),
    ApiOperation({ summary: 'Update an institution' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateInstitutionDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "updateInstitution", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Delete('institutions/:id'),
    ApiOperation({ summary: 'Delete an institution' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "deleteInstitution", null);
__decorate([
    Get('branches'),
    ApiOperation({ summary: 'Get all branches' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getBranches", null);
__decorate([
    Get('branches/options'),
    ApiOperation({ summary: 'Get lightweight branch options for dropdowns' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getBranchesOptions", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Post('branches'),
    ApiOperation({ summary: 'Create a branch with geofence settings' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateBranchDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "createBranch", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Patch('branches/:id'),
    ApiOperation({ summary: 'Update a branch' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateBranchDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "updateBranch", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Delete('branches/:id'),
    ApiOperation({ summary: 'Delete a branch' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "deleteBranch", null);
__decorate([
    Get('groups'),
    ApiOperation({ summary: 'Get all groups' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getGroups", null);
__decorate([
    Get('groups/options'),
    ApiOperation({ summary: 'Get lightweight group options for dropdowns' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getGroupsOptions", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Post('groups'),
    ApiOperation({ summary: 'Create a group' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateGroupDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "createGroup", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Patch('groups/:id'),
    ApiOperation({ summary: 'Update a group' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateGroupDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "updateGroup", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Delete('groups/:id'),
    ApiOperation({ summary: 'Delete a group' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "deleteGroup", null);
__decorate([
    Get('shifts'),
    ApiOperation({ summary: 'Get all shifts' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getShifts", null);
__decorate([
    Get('shifts/keys'),
    ApiOperation({ summary: 'Get shift keys list' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "getShiftsKeys", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Post('shifts'),
    ApiOperation({ summary: 'Create a shift' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateShiftDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "createShift", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Patch('shifts/:id'),
    ApiOperation({ summary: 'Update a shift' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Param('id')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateShiftDto]),
    __metadata("design:returntype", Promise)
], CatalogController.prototype, "updateShift", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Delete('shifts/:id'),
    ApiOperation({ summary: 'Delete a shift' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
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