import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Page } from '../../common/decorators/page.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { Role } from '../../common/enums/index.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { attachment } from '../../infrastructure/export/workbook.js';
import { JSON_CONTENT_TYPE } from '../../config/constants.js';
import { SuperadminService } from './superadmin.service.js';
import {
  RestoreResultDto,
  RestoreSuperadminDto,
  SuperadminAccountDto,
} from './dto/superadmin.dto.js';

/**
 * Backing up and restoring the accounts that can do everything.
 *
 * SUPERADMIN ONLY, every route. An admin has no business reading the list, and
 * certainly none downloading the hashes — these are the credentials that could
 * grant themselves anything.
 */
@ApiTags('Superadmin')
@ApiBearerAuth()
@Controller('api/v1/superadmin')
export class SuperadminController {
  constructor(private readonly service: SuperadminService) {}

  // The backup page is grantable: listing and downloading open with the grant.
  // Restoring does not — it creates superadmins, and a superadmin is only ever
  // created by a superadmin, whatever page the actor holds.
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('backup')
  @Get('accounts')
  @ApiOperation({ summary: 'List the superadmin accounts (Superadmin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<SuperadminAccountDto[]> })
  async list(): Promise<ApiResponse<SuperadminAccountDto[]>> {
    const data = await this.service.list();
    return new ApiResponse(data as SuperadminAccountDto[]);
  }

  /**
   * Download the backup.
   *
   * Sent as an ATTACHMENT rather than through the usual response envelope, so
   * the bytes the browser saves are exactly the bytes
   * `scripts/superadmin-restore.mjs` expects. A file that has to be unwrapped
   * before the script will take it is a file somebody will get wrong at the
   * worst possible moment.
   */
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Page('backup', 'export')
  @Get('backup')
  @ApiOperation({ summary: 'Download a superadmin backup file (Superadmin only)' })
  async backup(
    @CallerDecorator() caller: Caller,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const file = await this.service.backup(caller);
    const stamp = new Date().toISOString().slice(0, 10);

    await reply
      .header('content-type', JSON_CONTENT_TYPE)
      .header('content-disposition', attachment(`superadmin-backup-${stamp}.json`))
      .send(JSON.stringify(file, null, 2));
  }

  @Roles(Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @Post('restore')
  @ApiOperation({ summary: 'Restore superadmin accounts from a backup (Superadmin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<RestoreResultDto> })
  async restore(
    @CallerDecorator() caller: Caller,
    @Body() body: RestoreSuperadminDto,
  ): Promise<ApiResponse<RestoreResultDto>> {
    const data = await this.service.restore(caller, body.file, body.overwrite === true);
    return new ApiResponse(data);
  }
}
