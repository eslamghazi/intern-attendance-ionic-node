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
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import { Role } from '../../common/enums/index.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { attachment } from '../../infrastructure/export/workbook.js';
import { JSON_CONTENT_TYPE } from '../../config/constants.js';
import { SuperadminService } from './superadmin.service.js';
import { RestoreSuperadminDto, } from './dto/superadmin.dto.js';
/**
 * Backing up and restoring the accounts that can do everything.
 *
 * SUPERADMIN ONLY, every route. An admin has no business reading the list, and
 * certainly none downloading the hashes — these are the credentials that could
 * grant themselves anything.
 */
let SuperadminController = class SuperadminController {
    service;
    constructor(service) {
        this.service = service;
    }
    async list() {
        const data = await this.service.list();
        return new ApiResponse(data);
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
    async backup(caller, reply) {
        const file = await this.service.backup(caller);
        const stamp = new Date().toISOString().slice(0, 10);
        await reply
            .header('content-type', JSON_CONTENT_TYPE)
            .header('content-disposition', attachment(`superadmin-backup-${stamp}.json`))
            .send(JSON.stringify(file, null, 2));
    }
    async restore(caller, body) {
        const data = await this.service.restore(caller, body.file, body.overwrite === true);
        return new ApiResponse(data);
    }
};
__decorate([
    Roles(Role.SUPERADMIN),
    Get('accounts'),
    ApiOperation({ summary: 'List the superadmin accounts (Superadmin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SuperadminController.prototype, "list", null);
__decorate([
    Roles(Role.SUPERADMIN),
    Get('backup'),
    ApiOperation({ summary: 'Download a superadmin backup file (Superadmin only)' }),
    __param(0, CallerDecorator()),
    __param(1, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SuperadminController.prototype, "backup", null);
__decorate([
    Roles(Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Post('restore'),
    ApiOperation({ summary: 'Restore superadmin accounts from a backup (Superadmin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, RestoreSuperadminDto]),
    __metadata("design:returntype", Promise)
], SuperadminController.prototype, "restore", null);
SuperadminController = __decorate([
    ApiTags('Superadmin'),
    ApiBearerAuth(),
    Controller('api/v1/superadmin'),
    __metadata("design:paramtypes", [SuperadminService])
], SuperadminController);
export { SuperadminController };
//# sourceMappingURL=superadmin.controller.js.map