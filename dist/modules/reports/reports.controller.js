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
import { Controller, Get, Post, Body, Query, } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import { badRequest } from '../../http/errors.js';
import { ReportsService } from './reports.service.js';
import { ApiResponse, PaginatedResponse } from '../../common/dto/api-response.dto.js';
import { GetPresentQueryDto, GetReviewQueryDto, GetDetailQueryDto, GetHistoryQueryDto, GetDayQueryDto, GetDailyRosterQueryDto, GetMonthlyQueryDto, GetReportQueryDto, GetTodayQueryDto, GetStatsQueryDto, GetProbesDto, } from './dto/reports.dto.js';
import { Role } from '../../common/enums/index.js';
let ReportsController = class ReportsController {
    reportsService;
    constructor(reportsService) {
        this.reportsService = reportsService;
    }
    async getPresent(claims, query) {
        if (!query?.dates)
            throw badRequest('invalid_query', 'dates is required');
        const dates = query.dates.split(',').map((d) => d.trim()).filter(Boolean);
        const data = await this.reportsService.getPresent(claims, dates);
        return new ApiResponse(data);
    }
    async getReview(claims, query) {
        if (!query?.date)
            throw badRequest('invalid_query', 'date is required');
        const data = await this.reportsService.getReview(claims, query.date, query.branch_id);
        return new ApiResponse(data);
    }
    async getDetail(claims, query) {
        if (!query?.member_id || !query?.date)
            throw badRequest('invalid_query', 'member_id and date are required');
        const data = await this.reportsService.getDetail(claims, query.member_id, query.date, query.shift_id);
        return new ApiResponse(data);
    }
    async getHistory(claims, query) {
        if (!query?.member_id)
            throw badRequest('invalid_query', 'member_id is required');
        const data = await this.reportsService.getHistory(claims, query.member_id, query.year, query.month);
        return new ApiResponse(data);
    }
    async getDay(claims, query) {
        if (!query?.member_id || !query?.date)
            throw badRequest('invalid_query', 'member_id and date are required');
        const data = await this.reportsService.getDay(claims, query.member_id, query.date);
        return new ApiResponse(data);
    }
    async getDailyRoster(claims, query) {
        if (!query?.date)
            throw badRequest('invalid_query', 'date is required');
        const data = await this.reportsService.getDailyRoster(claims, query.date, query.branch_id);
        return new ApiResponse(data);
    }
    async getMonthly(claims, query) {
        const { page = 1, page_size: pageSize = 50, year, month, ...filters } = query;
        if (!year || !month)
            throw badRequest('invalid_query', 'year and month are required');
        const data = await this.reportsService.getMonthly(claims, filters, year, month, page, pageSize);
        return new PaginatedResponse(data.rows, data.total, { page, pageSize });
    }
    async getReport(claims, query) {
        if (!query?.from || !query?.to)
            throw badRequest('invalid_query', 'from and to are required');
        const data = await this.reportsService.getReport(claims, query.from, query.to, query.branch_id, query.group_id);
        return new ApiResponse(data);
    }
    async getToday(claims, query) {
        if (!query?.date)
            throw badRequest('invalid_query', 'date is required');
        const data = await this.reportsService.getToday(claims, query.date);
        return new ApiResponse(data);
    }
    async getStats(claims, query) {
        if (!query?.year || !query?.month)
            throw badRequest('invalid_query', 'year and month are required');
        const data = await this.reportsService.getStats(claims, query.year, query.month, query);
        return new ApiResponse(data);
    }
    async getProbes(claims, body) {
        if (!body?.member_ids?.length)
            return new ApiResponse([]);
        const data = await this.reportsService.getProbes(claims, body.member_ids, body.from, body.to);
        return new ApiResponse(data);
    }
    async getProbePaths(claims) {
        const data = await this.reportsService.getProbePaths(claims);
        return new ApiResponse(data);
    }
};
__decorate([
    Get('present'),
    ApiOperation({ summary: 'Get currently present members for given dates' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetPresentQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getPresent", null);
__decorate([
    Get('review'),
    ApiOperation({ summary: 'Get daily review attendance data for branch/date' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetReviewQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getReview", null);
__decorate([
    Get('detail'),
    ApiOperation({ summary: 'Get detailed attendance record for member/date' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetDetailQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getDetail", null);
__decorate([
    Get('history'),
    ApiOperation({ summary: 'Get monthly attendance history for a member' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetHistoryQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getHistory", null);
__decorate([
    Get('day'),
    ApiOperation({ summary: 'Get member attendance status for a single day' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetDayQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getDay", null);
__decorate([
    Get('daily-roster'),
    ApiOperation({ summary: 'Get scheduled members roster for a given day' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetDailyRosterQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getDailyRoster", null);
__decorate([
    Get('monthly'),
    ApiOperation({ summary: 'Get monthly attendance grid with pagination' }),
    SwaggerResponse({ status: 200, type: (PaginatedResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetMonthlyQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getMonthly", null);
__decorate([
    Get('report'),
    ApiOperation({ summary: 'Generate attendance report across date range' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetReportQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getReport", null);
__decorate([
    Get('today'),
    ApiOperation({ summary: 'Get today summary of attendance' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetTodayQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getToday", null);
__decorate([
    Get('stats'),
    ApiOperation({ summary: 'Get attendance statistical metrics' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetStatsQueryDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getStats", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Post('probes'),
    ApiOperation({ summary: 'Get attendance face verification probes for members' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetProbesDto]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getProbes", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Get('probe-paths'),
    ApiOperation({ summary: 'Get list of all probe paths (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, ClaimsDecorator()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getProbePaths", null);
ReportsController = __decorate([
    ApiTags('Reports'),
    ApiBearerAuth(),
    Controller('api/v1/attendance'),
    __metadata("design:paramtypes", [ReportsService])
], ReportsController);
export { ReportsController };
//# sourceMappingURL=reports.controller.js.map