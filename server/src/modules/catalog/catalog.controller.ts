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
import type { JwtClaims } from '../../db/context.js';
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

@ApiTags('Catalog')
@ApiBearerAuth()
@Controller('api/v1')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /* Institutions */
  @Get('institutions')
  @ApiOperation({ summary: 'Get all institutions' })
  @SwaggerResponse({ status: 200, type: ApiResponse<InstitutionResponseDto[]> })
  async getInstitutions(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<InstitutionResponseDto[]>> {
    const data = await this.catalogService.getInstitutions(claims);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Post('institutions')
  @ApiOperation({ summary: 'Create an institution' })
  @SwaggerResponse({ status: 201, type: ApiResponse<InstitutionResponseDto> })
  async createInstitution(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: CreateInstitutionDto,
  ): Promise<ApiResponse<InstitutionResponseDto>> {
    const data = await this.catalogService.createInstitution(claims, body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Patch('institutions/:id')
  @ApiOperation({ summary: 'Update an institution' })
  @SwaggerResponse({ status: 200, type: ApiResponse<InstitutionResponseDto> })
  async updateInstitution(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
    @Body() body: UpdateInstitutionDto,
  ): Promise<ApiResponse<InstitutionResponseDto>> {
    const data = await this.catalogService.updateInstitution(claims, id, body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Delete('institutions/:id')
  @ApiOperation({ summary: 'Delete an institution' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteInstitution(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.catalogService.deleteInstitution(claims, id);
    return new ApiResponse({ ok: true });
  }

  /* Branches */
  @Get('branches')
  @ApiOperation({ summary: 'Get all branches' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BranchResponseDto[]> })
  async getBranches(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<BranchResponseDto[]>> {
    const data = await this.catalogService.getBranches(claims);
    return new ApiResponse(data);
  }

  @Get('branches/options')
  @ApiOperation({ summary: 'Get lightweight branch options for dropdowns' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BranchOptionResponseDto[]> })
  async getBranchesOptions(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<BranchOptionResponseDto[]>> {
    const data = await this.catalogService.getBranchesOptions(claims);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Post('branches')
  @ApiOperation({ summary: 'Create a branch with geofence settings' })
  @SwaggerResponse({ status: 201, type: ApiResponse<BranchResponseDto> })
  async createBranch(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: CreateBranchDto,
  ): Promise<ApiResponse<BranchResponseDto>> {
    const data = await this.catalogService.createBranch(claims, body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Patch('branches/:id')
  @ApiOperation({ summary: 'Update a branch' })
  @SwaggerResponse({ status: 200, type: ApiResponse<BranchResponseDto> })
  async updateBranch(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
    @Body() body: UpdateBranchDto,
  ): Promise<ApiResponse<BranchResponseDto>> {
    const data = await this.catalogService.updateBranch(claims, id, body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Delete('branches/:id')
  @ApiOperation({ summary: 'Delete a branch' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteBranch(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.catalogService.deleteBranch(claims, id);
    return new ApiResponse({ ok: true });
  }

  /* Groups */
  @Get('groups')
  @ApiOperation({ summary: 'Get all groups' })
  @SwaggerResponse({ status: 200, type: ApiResponse<GroupResponseDto[]> })
  async getGroups(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<GroupResponseDto[]>> {
    const data = await this.catalogService.getGroups(claims);
    return new ApiResponse(data);
  }

  @Get('groups/options')
  @ApiOperation({ summary: 'Get lightweight group options for dropdowns' })
  @SwaggerResponse({ status: 200, type: ApiResponse<GroupOptionResponseDto[]> })
  async getGroupsOptions(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<GroupOptionResponseDto[]>> {
    const data = await this.catalogService.getGroupsOptions(claims);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Post('groups')
  @ApiOperation({ summary: 'Create a group' })
  @SwaggerResponse({ status: 201, type: ApiResponse<GroupResponseDto> })
  async createGroup(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: CreateGroupDto,
  ): Promise<ApiResponse<GroupResponseDto>> {
    const data = await this.catalogService.createGroup(claims, body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Patch('groups/:id')
  @ApiOperation({ summary: 'Update a group' })
  @SwaggerResponse({ status: 200, type: ApiResponse<GroupResponseDto> })
  async updateGroup(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
    @Body() body: UpdateGroupDto,
  ): Promise<ApiResponse<GroupResponseDto>> {
    const data = await this.catalogService.updateGroup(claims, id, body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Delete('groups/:id')
  @ApiOperation({ summary: 'Delete a group' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteGroup(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.catalogService.deleteGroup(claims, id);
    return new ApiResponse({ ok: true });
  }

  /* Shifts */
  @Get('shifts')
  @ApiOperation({ summary: 'Get all shifts' })
  @SwaggerResponse({ status: 200, type: ApiResponse<ShiftResponseDto[]> })
  async getShifts(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<ShiftResponseDto[]>> {
    const data = await this.catalogService.getShifts(claims);
    return new ApiResponse(data);
  }

  @Get('shifts/keys')
  @ApiOperation({ summary: 'Get shift keys list' })
  @SwaggerResponse({ status: 200, type: ApiResponse<ShiftKeyOptionResponseDto[]> })
  async getShiftsKeys(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<ShiftKeyOptionResponseDto[]>> {
    const data = await this.catalogService.getShiftsKeys(claims);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Post('shifts')
  @ApiOperation({ summary: 'Create a shift' })
  @SwaggerResponse({ status: 201, type: ApiResponse<ShiftResponseDto> })
  async createShift(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: CreateShiftDto,
  ): Promise<ApiResponse<ShiftResponseDto>> {
    const data = await this.catalogService.createShift(claims, body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Patch('shifts/:id')
  @ApiOperation({ summary: 'Update a shift' })
  @SwaggerResponse({ status: 200, type: ApiResponse<ShiftResponseDto> })
  async updateShift(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
    @Body() body: UpdateShiftDto,
  ): Promise<ApiResponse<ShiftResponseDto>> {
    const data = await this.catalogService.updateShift(claims, id, body);
    return new ApiResponse(data);
  }

  @Roles(Role.SUPERADMIN, Role.ADMIN)
  @Delete('shifts/:id')
  @ApiOperation({ summary: 'Delete a shift' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: true }> })
  async deleteShift(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ ok: true }>> {
    await this.catalogService.deleteShift(claims, id);
    return new ApiResponse({ ok: true });
  }
}
