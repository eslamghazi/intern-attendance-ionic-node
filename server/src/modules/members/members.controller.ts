import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import type { JwtClaims } from '../../db/context.js';
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

@ApiTags('Members')
@ApiBearerAuth()
@Controller('api/v1/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Roles(Role.ADMIN, Role.SUPERADMIN)
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
  @Get('national-ids')
  @ApiOperation({ summary: 'Get list of existing member national IDs' })
  @SwaggerResponse({ status: 200, type: ApiResponse<string[]> })
  async getNationalIds(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<string[]>> {
    const data = await this.membersService.getNationalIds(claims);
    return new ApiResponse(data);
  }

  @Get()
  @ApiOperation({ summary: 'List members with optional filters' })
  @SwaggerResponse({ status: 200, type: PaginatedResponse<MemberDirectoryRowDto> })
  async getMembers(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: MemberFilterQueryDto,
  ): Promise<PaginatedResponse<MemberDirectoryRowDto>> {
    const { page = 1, page_size: pageSize = 50, ...filters } = query;
    const offset = (page - 1) * pageSize;
    const result = await this.membersService.getMembers(claims, filters, pageSize, offset);
    return new PaginatedResponse(result.rows, result.total, { page, pageSize });
  }

  @Get('page')
  @ApiOperation({ summary: 'Paginated members list' })
  @SwaggerResponse({ status: 200, type: PaginatedResponse<MemberPageItemDto> })
  async getMembersPage(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: MemberFilterQueryDto,
  ): Promise<PaginatedResponse<MemberPageItemDto>> {
    const { page = 1, page_size: pageSize = 50, ...filters } = query;
    const offset = (page - 1) * pageSize;
    const result = await this.membersService.getMembersPage(claims, filters, pageSize, offset);
    return new PaginatedResponse(result.items, result.total, { page, pageSize });
  }

  @Get('flag-stats')
  @ApiOperation({ summary: 'Get summary statistics of flagged members' })
  @SwaggerResponse({ status: 200, type: ApiResponse<FlagStatsResponseDto> })
  async getFlagStats(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: MemberFilterQueryDto,
  ): Promise<ApiResponse<FlagStatsResponseDto>> {
    const data = await this.membersService.getFlagStats(claims, query);
    return new ApiResponse(data);
  }

  @Get('count-active')
  @ApiOperation({ summary: 'Count active members' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ count: number }> })
  async getCountActive(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<{ count: number }>> {
    const data = await this.membersService.getCountActive(claims);
    return new ApiResponse(data);
  }

  @Get('by-profile/:profileId')
  @ApiOperation({ summary: 'Get member details by profile ID' })
  @SwaggerResponse({ status: 200, type: ApiResponse<MemberByProfileDto> })
  async getByProfile(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('profileId') profileId: string,
  ): Promise<ApiResponse<MemberByProfileDto>> {
    const data = await this.membersService.getByProfile(claims, profileId);
    return new ApiResponse(data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a member profile and attendance rules' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async updateMember(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
    @Body() body: UpdateMemberDto,
  ): Promise<ApiResponse<{ ok: boolean }>> {
    const data = await this.membersService.updateMember(claims, id, body);
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Delete('by-profile/:profileId')
  @ApiOperation({ summary: 'Delete a member by profile ID' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteByProfile(
    @CallerDecorator() caller: Caller | null,
    @ClaimsDecorator() claims: JwtClaims,
    @Param('profileId') profileId: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.membersService.deleteByProfile(caller!, claims, profileId);
    return new ApiResponse({ ok: true });
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post('bulk/flag')
  @ApiOperation({ summary: 'Bulk update a boolean flag across members' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BulkAffectedResponseDto> })
  async bulkFlag(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: BulkFlagDto,
  ): Promise<ApiResponse<BulkAffectedResponseDto>> {
    const { flag, value, ...filters } = body;
    const data = await this.membersService.bulkUpdate(claims, filters, { [flag]: value });
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post('bulk/frozen')
  @ApiOperation({ summary: 'Bulk update frozen date across members' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BulkAffectedResponseDto> })
  async bulkFrozen(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: BulkFrozenDto,
  ): Promise<ApiResponse<BulkAffectedResponseDto>> {
    const { frozen_at: frozenAt, ...filters } = body;
    const data = await this.membersService.bulkUpdate(claims, filters, { frozen_at: frozenAt });
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post('bulk/update')
  @ApiOperation({ summary: 'Bulk update members assignments or active status' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BulkAffectedResponseDto> })
  async bulkUpdatePost(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: BulkUpdateDto,
  ): Promise<ApiResponse<BulkAffectedResponseDto>> {
    const { group_id: groupId, branch_id: branchId, is_active: isActive, ...filters } = body;
    const patch: Record<string, unknown> = {};
    if (groupId) patch.group_id = groupId;
    if (branchId) patch.branch_id = branchId;
    if (isActive !== undefined) patch.is_active = isActive;
    const data = await this.membersService.bulkUpdate(claims, filters, patch);
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post('bulk/delete')
  @ApiOperation({ summary: 'Bulk delete members matching filter criteria' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BulkAffectedResponseDto> })
  async bulkDelete(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: BulkDeleteDto,
  ): Promise<ApiResponse<BulkAffectedResponseDto>> {
    const data = await this.membersService.bulkDelete(claims, body);
    return new ApiResponse(data);
  }
}
