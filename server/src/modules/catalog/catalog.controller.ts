import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { JwtClaims } from '../../db/context.js';
import { badRequest } from '../../http/errors.js';
import { CatalogService } from './catalog.service.js';

const uuid = z.string().uuid();

const institutionBody = z.object({
  name: z.string().trim().min(1),
  code: z.coerce.number().int().default(0),
});

const branchBody = z.object({
  name: z.string().trim().min(1),
  address: z.string().nullish(),
  latitude: z.number(),
  longitude: z.number(),
  radius_meters: z.coerce.number().int(),
  area_coords: z.array(z.unknown()).nullish(),
  institution_id: uuid.nullish(),
  bypass_face: z.boolean().default(false),
  bypass_location: z.boolean().default(false),
  bypass_checkout_window: z.boolean().default(false),
  require_qr: z.boolean().default(false),
  qr_enabled: z.boolean().default(true),
  block_checkin: z.boolean().default(false),
});

const groupBody = z.object({
  name: z.string().trim().min(1),
  year: z.coerce.number().int(),
  institution_id: uuid.nullish(),
  branch_id: uuid.nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  bypass_face: z.boolean().default(false),
  bypass_location: z.boolean().default(false),
  bypass_checkout_window: z.boolean().default(false),
});

const shiftBody = z.object({
  name: z.string().trim().min(1),
  key: z.string().nullish(),
  checkin_open: z.string().nullish(),
  checkin_late: z.string().nullish(),
  checkin_close: z.string().nullish(),
  checkout_open: z.string().nullish(),
  checkout_close: z.string().nullish(),
  start_time: z.string(),
  end_time: z.string(),
});

@Controller('api/v1')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('institutions')
  async getInstitutions(@ClaimsDecorator() claims: JwtClaims) {
    return this.catalogService.getInstitutions(claims);
  }

  @Get('branches')
  async getBranches(@ClaimsDecorator() claims: JwtClaims) {
    return this.catalogService.getBranches(claims);
  }

  @Get('groups')
  async getGroups(@ClaimsDecorator() claims: JwtClaims) {
    return this.catalogService.getGroups(claims);
  }

  @Get('shifts')
  async getShifts(@ClaimsDecorator() claims: JwtClaims) {
    return this.catalogService.getShifts(claims);
  }

  @Get('branches/options')
  async getBranchesOptions(@ClaimsDecorator() claims: JwtClaims) {
    return this.catalogService.getBranchesOptions(claims);
  }

  @Get('groups/options')
  async getGroupsOptions(@ClaimsDecorator() claims: JwtClaims) {
    return this.catalogService.getGroupsOptions(claims);
  }

  @Get('shifts/keys')
  async getShiftsKeys(@ClaimsDecorator() claims: JwtClaims) {
    return this.catalogService.getShiftsKeys(claims);
  }

  /* Institutions CRUD */
  @Roles('superadmin')
  @Post('institutions')
  @HttpCode(HttpStatus.CREATED)
  async createInstitution(@ClaimsDecorator() claims: JwtClaims, @Body() body: unknown) {
    const parsed = institutionBody.safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid institutions payload');
    return this.catalogService.createInstitution(claims, parsed.data);
  }

  @Roles('superadmin')
  @Patch('institutions/:id')
  async updateInstitution(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = institutionBody.safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid institutions payload');
    return this.catalogService.updateInstitution(claims, id, parsed.data);
  }

  @Roles('superadmin')
  @Delete('institutions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteInstitution(@ClaimsDecorator() claims: JwtClaims, @Param('id') id: string) {
    await this.catalogService.deleteInstitution(claims, id);
  }

  /* Branches CRUD */
  @Roles('superadmin')
  @Post('branches')
  @HttpCode(HttpStatus.CREATED)
  async createBranch(@ClaimsDecorator() claims: JwtClaims, @Body() body: unknown) {
    const parsed = branchBody.safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid branches payload');
    return this.catalogService.createBranch(claims, parsed.data);
  }

  @Roles('superadmin')
  @Patch('branches/:id')
  async updateBranch(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = branchBody.safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid branches payload');
    return this.catalogService.updateBranch(claims, id, parsed.data);
  }

  @Roles('superadmin')
  @Delete('branches/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBranch(@ClaimsDecorator() claims: JwtClaims, @Param('id') id: string) {
    await this.catalogService.deleteBranch(claims, id);
  }

  /* Groups CRUD */
  @Roles('superadmin')
  @Post('groups')
  @HttpCode(HttpStatus.CREATED)
  async createGroup(@ClaimsDecorator() claims: JwtClaims, @Body() body: unknown) {
    const parsed = groupBody.safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid groups payload');
    return this.catalogService.createGroup(claims, parsed.data);
  }

  @Roles('superadmin')
  @Patch('groups/:id')
  async updateGroup(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = groupBody.safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid groups payload');
    return this.catalogService.updateGroup(claims, id, parsed.data);
  }

  @Roles('superadmin')
  @Delete('groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGroup(@ClaimsDecorator() claims: JwtClaims, @Param('id') id: string) {
    await this.catalogService.deleteGroup(claims, id);
  }

  /* Shifts CRUD */
  @Roles('superadmin')
  @Post('shifts')
  @HttpCode(HttpStatus.CREATED)
  async createShift(@ClaimsDecorator() claims: JwtClaims, @Body() body: unknown) {
    const parsed = shiftBody.safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid shifts payload');
    return this.catalogService.createShift(claims, parsed.data);
  }

  @Roles('superadmin')
  @Patch('shifts/:id')
  async updateShift(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = shiftBody.safeParse(body);
    if (!parsed.success) throw badRequest('invalid', 'invalid shifts payload');
    return this.catalogService.updateShift(claims, id, parsed.data);
  }

  @Roles('superadmin')
  @Delete('shifts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteShift(@ClaimsDecorator() claims: JwtClaims, @Param('id') id: string) {
    await this.catalogService.deleteShift(claims, id);
  }
}
