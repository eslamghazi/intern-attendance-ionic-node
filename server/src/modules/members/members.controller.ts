import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AnyStaff, Page } from '../../common/decorators/page.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { MembersService } from './members.service.js';
import { ApiResponse, PaginatedResponse } from '../../common/dto/api-response.dto.js';
import {
  MemberDto,
  MemberDirectoryRowDto,
  MemberPageItemDto,
  MemberByProfileDto,
  CreateMemberInputDto,
  CreateMembersBatchDto,
  UpdateMemberDto,
  MemberFilterQueryDto,
  BulkFlagDto,
  BulkFrozenDto,
  BulkUpdateDto,
  BulkDeleteDto,
  BulkAffectedResponseDto,
  CreateMemberResultDto,
  FlagStatsResponseDto,
} from './dto/member.dto.js';
import { Role } from '../../common/enums/index.js';
import { Lang } from '../../common/decorators/lang.decorator.js';
import type { SupportedLanguage } from '../../common/i18n/i18n.types.js';
import { I18nService } from '../../common/i18n/i18n.service.js';
import { parseFormat, sendReport } from '../../infrastructure/export/render.js';
import { isStaff } from '../../domain/identity/role.js';
import { badRequest, forbidden } from '../../common/errors.js';
import type { LookupResult } from './members.types.js';

@ApiTags('Members')
@ApiBearerAuth()
@Controller('api/v1/members')
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly i18n: I18nService,
  ) {}

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @Page('members', 'create')
  @Post()
  @ApiOperation({ summary: 'Create member or batch of members' })
  @SwaggerResponse({ status: 201, type: ApiResponse<CreateMemberResultDto> })
  async createMembers(
    @CallerDecorator() caller: Caller | null,
    @Body() body: CreateMembersBatchDto,
  ): Promise<ApiResponse<CreateMemberResultDto>> {
    const data = await this.membersService.createMembers(caller!, body.members);
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('members')
  @Get('national-ids')
  @ApiOperation({ summary: 'Get list of existing member national IDs' })
  @SwaggerResponse({ status: 200, type: ApiResponse<string[]> })
  async getNationalIds(): Promise<ApiResponse<string[]>> {
    const data = await this.membersService.getNationalIds();
    return new ApiResponse(data);
  }

  // STAFF ONLY. This returns the directory — every member's name, national id,
  // phone and email — so it is the single most sensitive read in the module.
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('members')
  @Get()
  @ApiOperation({ summary: 'List members with optional filters (Admin only)' })
  @SwaggerResponse({ status: 200, type: PaginatedResponse<MemberDirectoryRowDto> })
  async getMembers(
    @Query() query: MemberFilterQueryDto,
  ): Promise<PaginatedResponse<MemberDirectoryRowDto>> {
    const { page = 1, page_size: pageSize = 50, ...filters } = query;
    const offset = (page - 1) * pageSize;
    const result = await this.membersService.getMembers(filters, pageSize, offset);
    return new PaginatedResponse(result.rows, result.total, { page, pageSize });
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('members')
  @Get('page')
  @ApiOperation({ summary: 'Paginated members list (Admin only)' })
  @SwaggerResponse({ status: 200, type: PaginatedResponse<MemberPageItemDto> })
  async getMembersPage(
    @Query() query: MemberFilterQueryDto,
  ): Promise<PaginatedResponse<MemberPageItemDto>> {
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
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('memberLookup')
  @Get('lookup')
  @ApiOperation({ summary: 'Find one member by code or national id, faculty-wide (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<LookupResult> })
  async lookupMember(
    @CallerDecorator() caller: Caller,
    @Query('q') q: string,
  ): Promise<ApiResponse<LookupResult>> {
    const identifier = (q ?? '').trim();
    if (!identifier) throw badRequest('invalid_query', 'q is required');

    return new ApiResponse(await this.membersService.lookup(caller, identifier));
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('members', 'export')
  @Get('export')
  @ApiOperation({ summary: 'Export the filtered members as .xlsx (Admin only)' })
  async exportMembers(
    @Query() query: MemberFilterQueryDto,
    @Lang() lang: SupportedLanguage,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { page: _page, page_size: _pageSize, ...filters } = query;
    const rows = await this.membersService.getMembersForExport(filters);

    const t = (key: string) => this.i18n.translate(`report.${key}`, lang);
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

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('members')
  @Get('flag-stats')
  @ApiOperation({ summary: 'Get summary statistics of flagged members (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<FlagStatsResponseDto> })
  async getFlagStats(
    @Query() query: MemberFilterQueryDto,
  ): Promise<ApiResponse<FlagStatsResponseDto>> {
    const data = await this.membersService.getFlagStats(query);
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @AnyStaff()
  @Get('count-active')
  @ApiOperation({ summary: 'Count active members (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ count: number }> })
  async getCountActive(): Promise<ApiResponse<{ count: number }>> {
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
  @Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN)
  @AnyStaff()
  @Get('by-profile/:profileId')
  @ApiOperation({ summary: 'Get member details by profile ID (own, or staff)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<MemberByProfileDto> })
  async getByProfile(
    @CallerDecorator() caller: Caller | null,
    @Param('profileId') profileId: string,
  ): Promise<ApiResponse<MemberByProfileDto>> {
    if (!caller) throw forbidden();
    if (!isStaff(caller.role) && caller.id !== profileId) throw forbidden();

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
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('members', 'edit')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a member profile and attendance rules (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async updateMember(
    @Param('id') id: string,
    @Body() body: UpdateMemberDto,
  ): Promise<ApiResponse<{ ok: boolean }>> {
    const data = await this.membersService.updateMember(id, body);
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('members', 'delete')
  @Delete('by-profile/:profileId')
  @ApiOperation({ summary: 'Delete a member by profile ID' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteByProfile(
    @CallerDecorator() caller: Caller | null,
    @Param('profileId') profileId: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.membersService.deleteByProfile(caller!, profileId);
    return new ApiResponse({ ok: true });
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @Page('members', 'edit')
  @Post('bulk/flag')
  @ApiOperation({ summary: 'Bulk update a boolean flag across members' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BulkAffectedResponseDto> })
  async bulkFlag(
    @Body() body: BulkFlagDto,
  ): Promise<ApiResponse<BulkAffectedResponseDto>> {
    const { flag, value, ...filters } = body;
    const data = await this.membersService.bulkUpdate(filters, { [flag]: value });
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @Page('members', 'edit')
  @Post('bulk/frozen')
  @ApiOperation({ summary: 'Bulk update frozen date across members' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BulkAffectedResponseDto> })
  async bulkFrozen(
    @Body() body: BulkFrozenDto,
  ): Promise<ApiResponse<BulkAffectedResponseDto>> {
    const { frozen_at: frozenAt, ...filters } = body;
    const data = await this.membersService.bulkUpdate(filters, { frozen_at: frozenAt });
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @Page('members', 'edit')
  @Post('bulk/update')
  @ApiOperation({ summary: 'Bulk update members assignments or active status' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BulkAffectedResponseDto> })
  async bulkUpdatePost(
    @Body() body: BulkUpdateDto,
  ): Promise<ApiResponse<BulkAffectedResponseDto>> {
    const { group_id: groupId, branch_id: branchId, is_active: isActive, ...filters } = body;
    const data = await this.membersService.bulkUpdate(filters, {
      ...(groupId ? { group_id: groupId } : {}),
      ...(branchId ? { branch_id: branchId } : {}),
      ...(isActive !== undefined ? { is_active: isActive } : {}),
    });
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @Page('members', 'delete')
  @Post('bulk/delete')
  @ApiOperation({ summary: 'Bulk delete members matching filter criteria' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BulkAffectedResponseDto> })
  async bulkDelete(
    @Body() body: BulkDeleteDto,
  ): Promise<ApiResponse<BulkAffectedResponseDto>> {
    const data = await this.membersService.bulkDelete(body);
    return new ApiResponse(data);
  }
}
