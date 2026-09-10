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
import { Controller, Get, Put, Delete, Body, Param, Query, } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import { badRequest } from '../../http/errors.js';
import { DepartmentsService } from './departments.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { UpdateDepartmentDto, PutMemberDepartmentDto } from './dto/department.dto.js';
import { Role } from '../../common/enums/index.js';
let DepartmentsController = class DepartmentsController {
    departmentsService;
    constructor(departmentsService) {
        this.departmentsService = departmentsService;
    }
    async getDepartments(claims) {
        const data = await this.departmentsService.getDepartments(claims);
        return new ApiResponse(data);
    }
    async getDepartmentsOptions(claims, branchId) {
        const data = await this.departmentsService.getDepartmentsOptions(claims, branchId);
        return new ApiResponse(data);
    }
    async putDepartment(caller, claims, body) {
        const data = await this.departmentsService.putDepartment(caller, claims, {
            id: body.id,
            name: body.name,
            branch_id: body.branch_id ?? null,
        });
        return new ApiResponse(data);
    }
    async deleteDepartment(caller, claims, id) {
        const data = await this.departmentsService.deleteDepartment(caller, claims, id);
        return new ApiResponse(data);
    }
    async getMemberDepartments(claims, year, month) {
        const y = Number(year);
        const m = Number(month);
        if (!y || !m)
            throw badRequest('invalid_query', 'Invalid year or month');
        const data = await this.departmentsService.getMemberDepartments(claims, y, m);
        return new ApiResponse(data);
    }
    async putMemberDepartment(claims, body) {
        const data = await this.departmentsService.putMemberDepartment(claims, {
            member_id: body.member_id,
            year: body.year,
            month: body.month,
            department_id: body.department_id ?? null,
        });
        return new ApiResponse(data);
    }
};
__decorate([
    Get(),
    ApiOperation({ summary: 'Get all departments with branch names' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DepartmentsController.prototype, "getDepartments", null);
__decorate([
    Get('options'),
    ApiOperation({ summary: 'Get department options for select dropdowns' }),
    ApiQuery({ name: 'branch_id', required: false, type: String }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query('branch_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DepartmentsController.prototype, "getDepartmentsOptions", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Put(),
    ApiOperation({ summary: 'Upsert a department' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, ClaimsDecorator()),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, UpdateDepartmentDto]),
    __metadata("design:returntype", Promise)
], DepartmentsController.prototype, "putDepartment", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Delete(':id'),
    ApiOperation({ summary: 'Delete a department' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, ClaimsDecorator()),
    __param(2, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], DepartmentsController.prototype, "deleteDepartment", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Get('members'),
    ApiOperation({ summary: 'Get member-department mappings for month/year' }),
    ApiQuery({ name: 'year', required: true, type: Number }),
    ApiQuery({ name: 'month', required: true, type: Number }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query('year')),
    __param(2, Query('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], DepartmentsController.prototype, "getMemberDepartments", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Put('members'),
    ApiOperation({ summary: 'Assign or clear member department for month/year' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, PutMemberDepartmentDto]),
    __metadata("design:returntype", Promise)
], DepartmentsController.prototype, "putMemberDepartment", null);
DepartmentsController = __decorate([
    ApiTags('Departments'),
    ApiBearerAuth(),
    Controller('api/v1/departments'),
    __metadata("design:paramtypes", [DepartmentsService])
], DepartmentsController);
export { DepartmentsController };
let MemberDepartmentsController = class MemberDepartmentsController {
    departmentsService;
    constructor(departmentsService) {
        this.departmentsService = departmentsService;
    }
    async getMemberDepartments(claims, year, month) {
        const y = Number(year);
        const m = Number(month);
        if (!y || !m)
            throw badRequest('invalid_query', 'Invalid year or month');
        const data = await this.departmentsService.getMemberDepartments(claims, y, m);
        return new ApiResponse(data);
    }
    async putMemberDepartment(claims, body) {
        const data = await this.departmentsService.putMemberDepartment(claims, {
            member_id: body.member_id,
            year: body.year,
            month: body.month,
            department_id: body.department_id ?? null,
        });
        return new ApiResponse(data);
    }
};
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Get(),
    ApiOperation({ summary: 'Get member-department mappings for month/year' }),
    ApiQuery({ name: 'year', required: true, type: Number }),
    ApiQuery({ name: 'month', required: true, type: Number }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query('year')),
    __param(2, Query('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], MemberDepartmentsController.prototype, "getMemberDepartments", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Put(),
    ApiOperation({ summary: 'Assign or clear member department for month/year' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, PutMemberDepartmentDto]),
    __metadata("design:returntype", Promise)
], MemberDepartmentsController.prototype, "putMemberDepartment", null);
MemberDepartmentsController = __decorate([
    ApiTags('Departments'),
    ApiBearerAuth(),
    Controller('api/v1/member-departments'),
    __metadata("design:paramtypes", [DepartmentsService])
], MemberDepartmentsController);
export { MemberDepartmentsController };
//# sourceMappingURL=departments.controller.js.map