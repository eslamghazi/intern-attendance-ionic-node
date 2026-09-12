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
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AnyStaff, Page } from '../../common/decorators/page.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import { badRequest } from '../../common/errors.js';
import { RosterService } from './roster.service.js';
import { ApiResponse, PaginatedResponse } from '../../common/dto/api-response.dto.js';
import { MonthQueryDto, RosterDayInputDto, GetRosterViewQueryDto, GetExistingKeysDto, PostRosterDaysDto, BulkRosterDto, } from './dto/roster.dto.js';
import { Role } from '../../common/enums/index.js';
import { Lang } from '../../common/decorators/lang.decorator.js';
import { I18nService } from '../../common/i18n/i18n.service.js';
import { parseFormat } from '../../infrastructure/export/render.js';
import { ExportService } from '../../infrastructure/export/export.service.js';
import { daysInMonth } from '../../domain/report/matrix.js';
let RosterController = class RosterController {
    service;
    i18n;
    exports;
    constructor(service, i18n, exports) {
        this.service = service;
        this.i18n = i18n;
        this.exports = exports;
    }
    /**
     * The monthly roster as .xlsx — every member the filter matches.
     *
     * A day cell lists the shift keys rostered that day; then one column per
     * shift counting that member's slots, and a grand total. The closing rows are
     * the same counts down the columns, which is what makes the sheet answer
     * "how many people are on the morning shift on the 12th?" without a formula.
     */
    async exportRoster(caller, query, lang, reply) {
        const { page: _page, page_size: _pageSize, year, month, ...filters } = query;
        if (!year || !month)
            throw badRequest('invalid_query', 'year and month are required');
        const { rows, shifts, departments } = await this.service.getRosterForExport(caller, filters, year, month);
        const t = (key) => this.i18n.translate(`report.${key}`, lang);
        // One column when the grid was narrowed to a day, like the screen.
        const dayList = query.day ? [query.day] : Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);
        /** That member's cells for one day. */
        const cells = (r, day) => r.days[String(day)] ?? [];
        const body = rows.map((r) => [
            r.full_name,
            departments.get(r.member_id) ?? '',
            ...dayList.map((d) => cells(r, d).map((c) => c.label).join(' ')),
            ...shifts.map((sh) => String(dayList.reduce((sum, d) => sum + cells(r, d).filter((c) => c.shift_id === sh.id).length, 0))),
            String(dayList.reduce((sum, d) => sum + cells(r, d).length, 0)),
        ]);
        // One closing row per shift, then the all-shifts row.
        const totals = shifts.map((sh) => {
            const perDay = dayList.map((d) => rows.reduce((sum, r) => sum + cells(r, d).filter((c) => c.shift_id === sh.id).length, 0));
            return [
                sh.name,
                '',
                ...perDay.map(String),
                ...shifts.map((other) => other.id === sh.id ? String(perDay.reduce((a, b) => a + b, 0)) : ''),
                String(perDay.reduce((a, b) => a + b, 0)),
            ];
        });
        const perDayAll = dayList.map((d) => rows.reduce((sum, r) => sum + cells(r, d).length, 0));
        totals.push([
            t('total'),
            '',
            ...perDayAll.map(String),
            ...shifts.map(() => ''),
            String(perDayAll.reduce((a, b) => a + b, 0)),
        ]);
        const pad = (n) => String(n).padStart(2, '0');
        const doc = {
            title: `${t('roster')} ${pad(month)}-${year}`,
            rtl: lang === 'ar',
            landscape: true,
            generatedAt: `${t('generated_at')}: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
            headers: [
                t('full_name'),
                t('department'),
                ...dayList.map(String),
                ...shifts.map((sh) => sh.key || sh.name),
                t('total'),
            ],
            rows: [...body, ...totals],
        };
        await this.exports.send(reply, parseFormat(query.format), doc, `roster-${year}-${pad(month)}`);
    }
    async getRosterView(caller, query) {
        const { page = 1, page_size: pageSize = 50, year, month, ...filters } = query;
        if (!year || !month)
            throw badRequest('invalid_query', 'year and month are required');
        const offset = (page - 1) * pageSize;
        const data = await this.service.getRosterView(caller, filters, year, month, pageSize, offset);
        return new PaginatedResponse(data.rows, data.total, { page, pageSize });
    }
    async getRosterTotals(caller, query) {
        const { year, month, ...filters } = query;
        if (!year || !month)
            throw badRequest('invalid_query', 'year and month are required');
        const data = await this.service.getRosterTotals(caller, filters, year, month);
        return new ApiResponse(data);
    }
    async getMakerData(caller, query) {
        if (!query?.year || !query?.month)
            throw badRequest('invalid_query', 'year and month are required');
        const data = await this.service.getMakerData(caller, query.year, query.month);
        return new ApiResponse(data);
    }
    async getExistingKeys(caller, body) {
        if (!body?.year || !body?.month || !body?.member_ids) {
            throw badRequest('invalid_body', 'year, month, and member_ids are required');
        }
        const data = await this.service.getExistingKeys(caller, body.year, body.month, body.member_ids);
        return new ApiResponse(data);
    }
    async postRosterDays(caller, body) {
        let days = [];
        if (body?.days && Array.isArray(body.days)) {
            days = body.days;
        }
        else if (body?.member_id && body?.date && body?.shift_id) {
            days = [{ member_id: body.member_id, date: body.date, shift_id: body.shift_id }];
        }
        else {
            throw badRequest('invalid_body', 'invalid roster payload');
        }
        await this.service.postRosterDays(caller, days);
        return new ApiResponse({ ok: true });
    }
    async deleteRosterDays(caller, body) {
        if (!body?.member_id || !body?.date || !body?.shift_id) {
            throw badRequest('invalid_body', 'member_id, date, and shift_id are required');
        }
        await this.service.deleteRosterDays(caller, body);
        return new ApiResponse({ ok: true });
    }
    async bulkRoster(caller, body) {
        if (!body?.year || !body?.month || !body?.shift_id || !body?.mode) {
            throw badRequest('invalid_body', 'invalid bulk payload');
        }
        const data = await this.service.bulkRoster(caller, body);
        return new ApiResponse(data);
    }
};
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('rosters', 'export'),
    Get('export'),
    ApiOperation({ summary: 'Export the monthly roster as .xlsx (Admin only)' }),
    __param(0, CallerDecorator()),
    __param(1, Query()),
    __param(2, Lang()),
    __param(3, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetRosterViewQueryDto, String, Object]),
    __metadata("design:returntype", Promise)
], RosterController.prototype, "exportRoster", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('rosters'),
    Get('view'),
    ApiOperation({ summary: 'Get monthly roster grid view with pagination (Admin only)' }),
    SwaggerResponse({ status: 200, type: (PaginatedResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetRosterViewQueryDto]),
    __metadata("design:returntype", Promise)
], RosterController.prototype, "getRosterView", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('rosters'),
    Get('totals'),
    ApiOperation({ summary: 'Get monthly roster totals (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetRosterViewQueryDto]),
    __metadata("design:returntype", Promise)
], RosterController.prototype, "getRosterTotals", null);
__decorate([
    Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN),
    AnyStaff(),
    Get('maker-data'),
    ApiOperation({ summary: 'Get roster maker options and metadata for given month' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MonthQueryDto]),
    __metadata("design:returntype", Promise)
], RosterController.prototype, "getMakerData", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Page('rosters'),
    Post('existing-keys'),
    ApiOperation({ summary: 'Query existing roster schedule keys for members (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetExistingKeysDto]),
    __metadata("design:returntype", Promise)
], RosterController.prototype, "getExistingKeys", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Page('rosters', 'edit'),
    Post('days'),
    ApiOperation({ summary: 'Assign one or more member roster shift days' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, PostRosterDaysDto]),
    __metadata("design:returntype", Promise)
], RosterController.prototype, "postRosterDays", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('rosters', 'edit'),
    Delete('days'),
    ApiOperation({ summary: 'Remove a member roster shift assignment' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, RosterDayInputDto]),
    __metadata("design:returntype", Promise)
], RosterController.prototype, "deleteRosterDays", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Page('rosters', 'edit'),
    Post('bulk'),
    ApiOperation({ summary: 'Bulk schedule roster shifts across members' }),
    SwaggerResponse({ status: 201, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, BulkRosterDto]),
    __metadata("design:returntype", Promise)
], RosterController.prototype, "bulkRoster", null);
RosterController = __decorate([
    ApiTags('Roster'),
    ApiBearerAuth(),
    Controller('api/v1/roster'),
    __metadata("design:paramtypes", [RosterService,
        I18nService,
        ExportService])
], RosterController);
export { RosterController };
//# sourceMappingURL=roster.controller.js.map