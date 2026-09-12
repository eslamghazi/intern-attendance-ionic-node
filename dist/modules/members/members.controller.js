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
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AnyStaff, Page } from '../../common/decorators/page.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import { MembersService } from './members.service.js';
import { ApiResponse, PaginatedResponse } from '../../common/dto/api-response.dto.js';
import { CreateMembersBatchDto, UpdateMemberDto, MemberFilterQueryDto, BulkFlagDto, BulkFrozenDto, BulkUpdateDto, BulkDeleteDto, } from './dto/member.dto.js';
import { Role } from '../../common/enums/index.js';
import { Lang } from '../../common/decorators/lang.decorator.js';
import { I18nService } from '../../common/i18n/i18n.service.js';
import { parseFormat, sendReport } from '../../infrastructure/export/render.js';
import { isStaff } from '../../domain/identity/role.js';
import { badRequest, forbidden } from '../../common/errors.js';
let MembersController = class MembersController {
    membersService;
    i18n;
    constructor(membersService, i18n) {
        this.membersService = membersService;
        this.i18n = i18n;
    }
    async createMembers(caller, body) {
        const data = await this.membersService.createMembers(caller, body.members);
        return new ApiResponse(data);
    }
    async getNationalIds() {
        const data = await this.membersService.getNationalIds();
        return new ApiResponse(data);
    }
    // STAFF ONLY. This returns the directory — every member's name, national id,
    // phone and email — so it is the single most sensitive read in the module.
    async getMembers(query) {
        const { page = 1, page_size: pageSize = 50, ...filters } = query;
        const offset = (page - 1) * pageSize;
        const result = await this.membersService.getMembers(filters, pageSize, offset);
        return new PaginatedResponse(result.rows, result.total, { page, pageSize });
    }
    async getMembersPage(query) {
        const { page = 1, page_size: pageSize = 50, ...filters } = query;
        const offset = (page - 1) * pageSize;
        const result = await this.membersService.getMembersPage(filters, pageSize, offset);
        return new PaginatedResponse(result.items, result.total, { page, pageSize });
    }
    /**
     * The members export — every row the current filters match, as .xlsx.
     *
     * Takes the SAME query as `GET /members`, minus `page` and `page_size`: the
     * export is defined by the filter, not by a page. That is what removes the
     * old arrangement where the client asked for one enormous page and both sides
     * had to agree on a maximum.
     *
     * The file is built here rather than from rows sent to the browser, so the
     * set that lands in the sheet is the set the database matched — no stitching
     * of pages, and nothing that can be inserted between two of them.
     */
    /**
     * Find ONE member by their code or national id — faculty-wide.
     *
     * Every other member read is bounded by the caller's assignments. This one is
     * not, deliberately: a student turns up at the wrong hospital and somebody has
     * to be able to identify them. See MembersService.lookup for what keeps that
     * from being a way around the scope — one exact match, no list, and an audit
     * row whenever the member is outside the caller's own branches.
     */
    async lookupMember(caller, q) {
        const identifier = (q ?? '').trim();
        if (!identifier)
            throw badRequest('invalid_query', 'q is required');
        return new ApiResponse(await this.membersService.lookup(caller, identifier));
    }
    async exportMembers(query, lang, reply) {
        const { page: _page, page_size: _pageSize, ...filters } = query;
        const rows = await this.membersService.getMembersForExport(filters);
        const t = (key) => this.i18n.translate(`report.${key}`, lang);
        const doc = {
            title: t('members'),
            rtl: lang === 'ar',
            generatedAt: `${t('generated_at')}: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
            headers: [
                t('member_code'),
                t('national_id'),
                t('full_name'),
                t('phone'),
                t('email'),
                t('group'),
                t('branch'),
                t('status'),
            ],
            rows: rows.map((r) => [
                r.member_code ?? '',
                r.national_id ?? '',
                r.full_name ?? '',
                r.phone ?? '',
                r.email ?? '',
                r.group_name ?? '',
                r.branch_name ?? '',
                t(r.is_active ? 'active' : 'inactive'),
            ]),
        };
        await sendReport(reply, parseFormat(query.format), doc, `members-${new Date().toISOString().slice(0, 10)}`);
    }
    async getFlagStats(query) {
        const data = await this.membersService.getFlagStats(query);
        return new ApiResponse(data);
    }
    async getCountActive() {
        const data = await this.membersService.getCountActive();
        return new ApiResponse(data);
    }
    /**
     * Resolve a profile id to its members-row id.
     *
     * NOT staff-only, deliberately: a member calls this during face enrolment when
     * the auth bundle failed to hydrate their `member` (see the client's
     * FaceEnrollmentPage), and locking it to staff would dead-end enrolment.
     *
     * So it is scoped instead — a member may ask about THEMSELVES and nobody else.
     * Without this it answered for any profile id at all, which turns it into a
     * free profile-id-to-member-id oracle for the whole faculty.
     */
    async getByProfile(caller, profileId) {
        if (!caller)
            throw forbidden();
        if (!isStaff(caller.role) && caller.id !== profileId)
            throw forbidden();
        const data = await this.membersService.getByProfile(profileId);
        return new ApiResponse(data);
    }
    // STAFF ONLY, and this is the one that mattered most.
    //
    // It had no @Roles and does not even take a caller, so there was no check
    // anywhere in the stack — and MEMBER_COLUMNS includes `bypass_face` and
    // `bypass_location`. Any signed-in member could PATCH their own row and switch
    // off the face biometric and the geofence for themselves, which is the entire
    // point of the system.
    async updateMember(id, body) {
        const data = await this.membersService.updateMember(id, body);
        return new ApiResponse(data);
    }
    async deleteByProfile(caller, profileId) {
        await this.membersService.deleteByProfile(caller, profileId);
        return new ApiResponse({ ok: true });
    }
    async bulkFlag(body) {
        const { flag, value, ...filters } = body;
        const data = await this.membersService.bulkUpdate(filters, { [flag]: value });
        return new ApiResponse(data);
    }
    async bulkFrozen(body) {
        const { frozen_at: frozenAt, ...filters } = body;
        const data = await this.membersService.bulkUpdate(filters, { frozen_at: frozenAt });
        return new ApiResponse(data);
    }
    async bulkUpdatePost(body) {
        const { group_id: groupId, branch_id: branchId, is_active: isActive, ...filters } = body;
        const data = await this.membersService.bulkUpdate(filters, {
            ...(groupId ? { group_id: groupId } : {}),
            ...(branchId ? { branch_id: branchId } : {}),
            ...(isActive !== undefined ? { is_active: isActive } : {}),
        });
        return new ApiResponse(data);
    }
    async bulkDelete(body) {
        const data = await this.membersService.bulkDelete(body);
        return new ApiResponse(data);
    }
};
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Page('members', 'create'),
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
    Page('members'),
    Get('national-ids'),
    ApiOperation({ summary: 'Get list of existing member national IDs' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getNationalIds", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('members'),
    Get(),
    ApiOperation({ summary: 'List members with optional filters (Admin only)' }),
    SwaggerResponse({ status: 200, type: (PaginatedResponse) }),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [MemberFilterQueryDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getMembers", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('members'),
    Get('page'),
    ApiOperation({ summary: 'Paginated members list (Admin only)' }),
    SwaggerResponse({ status: 200, type: (PaginatedResponse) }),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [MemberFilterQueryDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getMembersPage", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('memberLookup'),
    Get('lookup'),
    ApiOperation({ summary: 'Find one member by code or national id, faculty-wide (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Query('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "lookupMember", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('members', 'export'),
    Get('export'),
    ApiOperation({ summary: 'Export the filtered members as .xlsx (Admin only)' }),
    __param(0, Query()),
    __param(1, Lang()),
    __param(2, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [MemberFilterQueryDto, String, Object]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "exportMembers", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('members'),
    Get('flag-stats'),
    ApiOperation({ summary: 'Get summary statistics of flagged members (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [MemberFilterQueryDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getFlagStats", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    AnyStaff(),
    Get('count-active'),
    ApiOperation({ summary: 'Count active members (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getCountActive", null);
__decorate([
    Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN),
    AnyStaff(),
    Get('by-profile/:profileId'),
    ApiOperation({ summary: 'Get member details by profile ID (own, or staff)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Param('profileId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getByProfile", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('members', 'edit'),
    Patch(':id'),
    ApiOperation({ summary: 'Update a member profile and attendance rules (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateMemberDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "updateMember", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('members', 'delete'),
    Delete('by-profile/:profileId'),
    ApiOperation({ summary: 'Delete a member by profile ID' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Param('profileId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "deleteByProfile", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Page('members', 'edit'),
    Post('bulk/flag'),
    ApiOperation({ summary: 'Bulk update a boolean flag across members' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BulkFlagDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "bulkFlag", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Page('members', 'edit'),
    Post('bulk/frozen'),
    ApiOperation({ summary: 'Bulk update frozen date across members' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BulkFrozenDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "bulkFrozen", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Page('members', 'edit'),
    Post('bulk/update'),
    ApiOperation({ summary: 'Bulk update members assignments or active status' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BulkUpdateDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "bulkUpdatePost", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Page('members', 'delete'),
    Post('bulk/delete'),
    ApiOperation({ summary: 'Bulk delete members matching filter criteria' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BulkDeleteDto]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "bulkDelete", null);
MembersController = __decorate([
    ApiTags('Members'),
    ApiBearerAuth(),
    Controller('api/v1/members'),
    __metadata("design:paramtypes", [MembersService,
        I18nService])
], MembersController);
export { MembersController };
//# sourceMappingURL=members.controller.js.map