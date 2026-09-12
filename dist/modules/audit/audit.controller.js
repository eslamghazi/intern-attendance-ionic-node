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
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import { Role } from '../../common/enums/index.js';
import { ApiResponse, PaginatedResponse } from '../../common/dto/api-response.dto.js';
import { AuditService } from './audit.service.js';
import { AuditQueryDto } from './dto/audit.dto.js';
/**
 * Reading the audit trail. Staff only, and scoped — see AuditRepository for
 * exactly whose events an assigned admin may see.
 *
 * There is no write endpoint, and there must never be one. Every row is written
 * by the server as a side effect of something it did itself; a route that
 * accepted audit rows would let a caller forge the record of their own refusal.
 */
let AuditController = class AuditController {
    auditService;
    constructor(auditService) {
        this.auditService = auditService;
    }
    toFilters(q) {
        const events = q.event === undefined ? undefined : Array.isArray(q.event) ? q.event : [q.event];
        return {
            events,
            actorId: q.actor_id,
            from: q.from,
            to: q.to,
            // A query string carries no booleans. Anything but an explicit "false"
            // being truthy would make `?security_only=false` mean the opposite of
            // what it says.
            securityOnly: q.security_only === '1' || q.security_only === 'true',
        };
    }
    async list(caller, query) {
        const page = query.page ?? 1;
        const pageSize = query.page_size ?? 50;
        const result = await this.auditService.list(caller, this.toFilters(query), pageSize, (page - 1) * pageSize);
        return new PaginatedResponse(result.rows, result.total, { page, pageSize });
    }
    async summary(caller, query) {
        return new ApiResponse(await this.auditService.summary(caller, this.toFilters(query)));
    }
};
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Get(),
    ApiOperation({ summary: 'Page through the audit trail, newest first' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, AuditQueryDto]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "list", null);
__decorate([
    Roles(Role.SUPERADMIN, Role.ADMIN),
    Get('summary'),
    ApiOperation({ summary: 'Count per event type, for the same filters' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, AuditQueryDto]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "summary", null);
AuditController = __decorate([
    ApiTags('Audit'),
    ApiBearerAuth(),
    Controller('api/v1/audit'),
    __metadata("design:paramtypes", [AuditService])
], AuditController);
export { AuditController };
//# sourceMappingURL=audit.controller.js.map