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
  CreateMemberInputDto,
  CreateMembersBatchDto,
  UpdateMemberDto,
  MemberFilterQueryDto,
} from './dto/member.dto.js';

@ApiTags('Members')
@ApiBearerAuth()
@Controller('api/v1/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Roles('admin', 'superadmin')
  @Post()
  @ApiOperation({ summary: 'Create member or batch of members' })
  @SwaggerResponse({ status: 201, type: ApiResponse<unknown> })
  async createMembers(
    @CallerDecorator() caller: Caller | null,
    @Body() body: CreateMembersBatchDto | CreateMemberInputDto,
  ): Promise<ApiResponse<unknown>> {
    const items = 'members' in body && Array.isArray(body.members) ? body.members : [body as CreateMemberInputDto];
    const data = await this.membersService.createMembers(caller!, items);
    return new ApiResponse(data);
  }

  @Roles('admin', 'superadmin')
  @Get('national-ids')
  @ApiOperation({ summary: 'Get list of existing member national IDs' })
  @SwaggerResponse({ status: 200, type: ApiResponse<string[]> })
  async getNationalIds(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<string[]>> {
    const data = await this.membersService.getNationalIds(claims);
    return new ApiResponse(data);
  }

  @Get()
  @ApiOperation({ summary: 'List members with optional filters' })
  @SwaggerResponse({ status: 200, type: PaginatedResponse<MemberDto> })
  async getMembers(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: MemberFilterQueryDto,
  ): Promise<PaginatedResponse<MemberDto>> {
    const { page, page_size: pageSize, ...filters } = query;
    const offset = (page - 1) * pageSize;
    const result = await this.membersService.getMembers(claims, filters as any, pageSize, offset);
    return new PaginatedResponse(result.rows as any, result.total);
  }

  @Get('page')
  @ApiOperation({ summary: 'Paginated members list' })
  @SwaggerResponse({ status: 200, type: PaginatedResponse<MemberDto> })
  async getMembersPage(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: MemberFilterQueryDto,
  ): Promise<PaginatedResponse<MemberDto>> {
    const { page, page_size: pageSize, ...filters } = query;
    const offset = (page - 1) * pageSize;
    const result = await this.membersService.getMembersPage(claims, filters as any, pageSize, offset);
    return new PaginatedResponse(result.items as any, result.total);
  }

  @Get('flag-stats')
  @ApiOperation({ summary: 'Get summary statistics of flagged members' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async getFlagStats(
    @ClaimsDecorator() claims: JwtClaims,
    @Query() query: MemberFilterQueryDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.membersService.getFlagStats(claims, query as any);
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
  @SwaggerResponse({ status: 200, type: ApiResponse<MemberDto | null> })
  async getByProfile(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('profileId') profileId: string,
  ): Promise<ApiResponse<MemberDto | null>> {
    const data = await this.membersService.getByProfile(claims, profileId);
    return new ApiResponse(data as any);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a member profile and attendance rules' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async updateMember(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
    @Body() body: UpdateMemberDto,
  ): Promise<ApiResponse<{ ok: boolean }>> {
    const data = await this.membersService.updateMember(claims, id, body as any);
    return new ApiResponse(data);
  }

  @Roles('admin', 'superadmin')
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

  @Roles('admin', 'superadmin')
  @Post('bulk/flag')
  @ApiOperation({ summary: 'Bulk update a boolean flag across members' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async bulkFlag(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    const { flag, value, ...filters } = body as any;
    const data = await this.membersService.bulkUpdate(claims, filters, { [flag]: value });
    return new ApiResponse(data);
  }

  @Roles('admin', 'superadmin')
  @Post('bulk/frozen')
  @ApiOperation({ summary: 'Bulk update frozen date across members' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async bulkFrozen(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    const { frozen_at: frozenAt, ...filters } = body as any;
    const data = await this.membersService.bulkUpdate(claims, filters, { frozen_at: frozenAt });
    return new ApiResponse(data);
  }

  @Roles('admin', 'superadmin')
  @Post('bulk/update')
  @ApiOperation({ summary: 'Bulk update members assignments or active status' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async bulkUpdatePost(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    const { group_id: groupId, branch_id: branchId, is_active: isActive, ...filters } = body as any;
    const patch: Record<string, unknown> = {};
    if (groupId) patch.group_id = groupId;
    if (branchId) patch.branch_id = branchId;
    if (isActive !== undefined) patch.is_active = isActive;
    const data = await this.membersService.bulkUpdate(claims, filters, patch);
    return new ApiResponse(data);
  }

  @Roles('admin', 'superadmin')
  @Post('bulk/delete')
  @ApiOperation({ summary: 'Bulk delete members matching filter criteria' })
  @SwaggerResponse({ status: 200, type: ApiResponse<unknown> })
  async bulkDelete(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: Record<string, unknown>,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.membersService.bulkDelete(claims, body as any);
    return new ApiResponse(data);
  }
}
