import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import { CatalogService } from './catalog.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import {
  CreateInstitutionDto,
  UpdateInstitutionDto,
  InstitutionResponseDto,
  CreateBranchDto,
  UpdateBranchDto,
  BranchResponseDto,
  BranchOptionResponseDto,
  CreateGroupDto,
  UpdateGroupDto,
  GroupResponseDto,
  GroupOptionResponseDto,
  CreateShiftDto,
  UpdateShiftDto,
  ShiftResponseDto,
  ShiftKeyOptionResponseDto,
} from './dto/catalog.dto.js';
import { Role } from '../../common/enums/index.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';

@ApiTags('Catalog')
@ApiBearerAuth()
@Controller('api/v1')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /* Institutions */
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('institutions')
  @ApiOperation({ summary: 'Get all institutions' })
  @SwaggerResponse({ status: 200, type: ApiResponse<InstitutionResponseDto[]> })
  async getInstitutions(): Promise<ApiResponse<InstitutionResponseDto[]>> {
    const data = await this.catalogService.getInstitutions();
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Post('institutions')
  @ApiOperation({ summary: 'Create an institution' })
  @SwaggerResponse({ status: 201, type: ApiResponse<InstitutionResponseDto> })
  async createInstitution(
    @Body() body: CreateInstitutionDto,
  ): Promise<ApiResponse<InstitutionResponseDto>> {
    const data = await this.catalogService.createInstitution(body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Patch('institutions/:id')
  @ApiOperation({ summary: 'Update an institution' })
  @SwaggerResponse({ status: 200, type: ApiResponse<InstitutionResponseDto> })
  async updateInstitution(
    @Param('id') id: string,
    @Body() body: UpdateInstitutionDto,
  ): Promise<ApiResponse<InstitutionResponseDto>> {
    const data = await this.catalogService.updateInstitution(id, body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Delete('institutions/:id')
  @ApiOperation({ summary: 'Delete an institution' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteInstitution(
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.catalogService.deleteInstitution(id);
    return new ApiResponse({ ok: true });
  }

  /* Branches */
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('branches')
  @ApiOperation({ summary: 'Get all branches' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BranchResponseDto[]> })
  async getBranches(): Promise<ApiResponse<BranchResponseDto[]>> {
    const data = await this.catalogService.getBranches();
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('branches/options')
  @ApiOperation({ summary: 'Get lightweight branch options for dropdowns' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BranchOptionResponseDto[]> })
  async getBranchesOptions(@CallerDecorator() caller: Caller): Promise<ApiResponse<BranchOptionResponseDto[]>> {
    const data = await this.catalogService.getBranchesOptions(caller);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Post('branches')
  @ApiOperation({ summary: 'Create a branch with geofence settings' })
  @SwaggerResponse({ status: 201, type: ApiResponse<BranchResponseDto> })
  async createBranch(
    @Body() body: CreateBranchDto,
  ): Promise<ApiResponse<BranchResponseDto>> {
    const data = await this.catalogService.createBranch(body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Patch('branches/:id')
  @ApiOperation({ summary: 'Update a branch' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BranchResponseDto> })
  async updateBranch(
    @Param('id') id: string,
    @Body() body: UpdateBranchDto,
  ): Promise<ApiResponse<BranchResponseDto>> {
    const data = await this.catalogService.updateBranch(id, body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Delete('branches/:id')
  @ApiOperation({ summary: 'Delete a branch' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteBranch(
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.catalogService.deleteBranch(id);
    return new ApiResponse({ ok: true });
  }

  /* Groups */
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('groups')
  @ApiOperation({ summary: 'Get all groups' })
  @SwaggerResponse({ status: 200, type: ApiResponse<GroupResponseDto[]> })
  async getGroups(): Promise<ApiResponse<GroupResponseDto[]>> {
    const data = await this.catalogService.getGroups();
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('groups/options')
  @ApiOperation({ summary: 'Get lightweight group options for dropdowns' })
  @SwaggerResponse({ status: 200, type: ApiResponse<GroupOptionResponseDto[]> })
  async getGroupsOptions(@CallerDecorator() caller: Caller): Promise<ApiResponse<GroupOptionResponseDto[]>> {
    const data = await this.catalogService.getGroupsOptions(caller);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Post('groups')
  @ApiOperation({ summary: 'Create a group' })
  @SwaggerResponse({ status: 201, type: ApiResponse<GroupResponseDto> })
  async createGroup(
    @Body() body: CreateGroupDto,
  ): Promise<ApiResponse<GroupResponseDto>> {
    const data = await this.catalogService.createGroup(body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Patch('groups/:id')
  @ApiOperation({ summary: 'Update a group' })
  @SwaggerResponse({ status: 200, type: ApiResponse<GroupResponseDto> })
  async updateGroup(
    @Param('id') id: string,
    @Body() body: UpdateGroupDto,
  ): Promise<ApiResponse<GroupResponseDto>> {
    const data = await this.catalogService.updateGroup(id, body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Delete('groups/:id')
  @ApiOperation({ summary: 'Delete a group' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteGroup(
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.catalogService.deleteGroup(id);
    return new ApiResponse({ ok: true });
  }

  /* Shifts */
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('shifts')
  @ApiOperation({ summary: 'Get all shifts' })
  @SwaggerResponse({ status: 200, type: ApiResponse<ShiftResponseDto[]> })
  async getShifts(): Promise<ApiResponse<ShiftResponseDto[]>> {
    const data = await this.catalogService.getShifts();
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('shifts/keys')
  @ApiOperation({ summary: 'Get shift keys list' })
  @SwaggerResponse({ status: 200, type: ApiResponse<ShiftKeyOptionResponseDto[]> })
  async getShiftsKeys(): Promise<ApiResponse<ShiftKeyOptionResponseDto[]>> {
    const data = await this.catalogService.getShiftsKeys();
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Post('shifts')
  @ApiOperation({ summary: 'Create a shift' })
  @SwaggerResponse({ status: 201, type: ApiResponse<ShiftResponseDto> })
  async createShift(
    @Body() body: CreateShiftDto,
  ): Promise<ApiResponse<ShiftResponseDto>> {
    const data = await this.catalogService.createShift(body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Patch('shifts/:id')
  @ApiOperation({ summary: 'Update a shift' })
  @SwaggerResponse({ status: 200, type: ApiResponse<ShiftResponseDto> })
  async updateShift(
    @Param('id') id: string,
    @Body() body: UpdateShiftDto,
  ): Promise<ApiResponse<ShiftResponseDto>> {
    const data = await this.catalogService.updateShift(id, body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Delete('shifts/:id')
  @ApiOperation({ summary: 'Delete a shift' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteShift(
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.catalogService.deleteShift(id);
    return new ApiResponse({ ok: true });
  }
}
