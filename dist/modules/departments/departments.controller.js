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
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import { badRequest } from '../../common/errors.js';
import { DepartmentsService } from './departments.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { UpdateDepartmentDto, PutMemberDepartmentDto } from './dto/department.dto.js';
import { Role } from '../../common/enums/index.js';
let DepartmentsController = class DepartmentsController {
    departmentsService;
    constructor(departmentsService) {
        this.departmentsService = departmentsService;
    }
    async getDepartments() {
        const data = await this.departmentsService.getDepartments();
        return new ApiResponse(data);
    }
    async getDepartmentsOptions(branchId) {
        const data = await this.departmentsService.getDepartmentsOptions(branchId);
        return new ApiResponse(data);
    }
    async putDepartment(caller, body) {
        const data = await this.departmentsService.putDepartment(caller, {
            id: body.id,
            name: body.name,
            branch_id: body.branch_id ?? null,
        });
        return new ApiResponse(data);
    }
    async deleteDepartment(caller, id) {
        const data = await this.departmentsService.deleteDepartment(caller, id);
        return new ApiResponse(data);
    }
    async getMemberDepartments(year, month) {
        const y = Number(year);
        const m = Number(month);
        if (!y || !m)
            throw badRequest('invalid_query', 'Invalid year or month');
        const data = await this.departmentsService.getMemberDepartments(y, m);
        return new ApiResponse(data);
    }
    async putMemberDepartment(body) {
        const data = await this.departmentsService.putMemberDepartment({
            member_id: body.member_id,
            year: body.year,
            month: body.month,
            department_id: body.department_id ?? null,
        });
        return new ApiResponse(data);
    }
};
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Get(),
    ApiOperation({ summary: 'Get all departments with branch names' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DepartmentsController.prototype, "getDepartments", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Get('options'),
    ApiOperation({ summary: 'Get department options for select dropdowns' }),
    ApiQuery({ name: 'branch_id', required: false, type: String }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Query('branch_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DepartmentsController.prototype, "getDepartmentsOptions", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Put(),
    ApiOperation({ summary: 'Upsert a department' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, UpdateDepartmentDto]),
    __metadata("design:returntype", Promise)
], DepartmentsController.prototype, "putDepartment", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Delete(':id'),
    ApiOperation({ summary: 'Delete a department' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DepartmentsController.prototype, "deleteDepartment", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Get('members'),
    ApiOperation({ summary: 'Get member-department mappings for month/year' }),
    ApiQuery({ name: 'year', required: true, type: Number }),
    ApiQuery({ name: 'month', required: true, type: Number }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Query('year')),
    __param(1, Query('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DepartmentsController.prototype, "getMemberDepartments", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Put('members'),
    ApiOperation({ summary: 'Assign or clear member department for month/year' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PutMemberDepartmentDto]),
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
    async getMemberDepartments(year, month) {
        const y = Number(year);
        const m = Number(month);
        if (!y || !m)
            throw badRequest('invalid_query', 'Invalid year or month');
        const data = await this.departmentsService.getMemberDepartments(y, m);
        return new ApiResponse(data);
    }
    async putMemberDepartment(body) {
        const data = await this.departmentsService.putMemberDepartment({
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
    __param(0, Query('year')),
    __param(1, Query('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MemberDepartmentsController.prototype, "getMemberDepartments", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Put(),
    ApiOperation({ summary: 'Assign or clear member department for month/year' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PutMemberDepartmentDto]),
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