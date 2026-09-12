var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { AuditEvent } from '../../../common/enums/index.js';
/**
 * What a caller may narrow the trail by.
 *
 * Every field is optional and every one is validated, because these reach a
 * WHERE clause. `event` is checked against the enum rather than passed through:
 * an unknown value would otherwise reach Postgres as a cast to `audit_event`
 * and come back as a 400 with a message about a type nobody asked about.
 */
export class AuditQueryDto {
    page;
    page_size;
    event;
    actor_id;
    from;
    to;
    /**
     * Only the events that describe someone trying to get past a control, rather
     * than the ordinary traffic of people arriving at work. Without it the signal
     * is one row in a hundred.
     */
    security_only;
}
__decorate([
    ApiPropertyOptional({ minimum: 1, default: 1 }),
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], AuditQueryDto.prototype, "page", void 0);
__decorate([
    ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 }),
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(200),
    __metadata("design:type", Number)
], AuditQueryDto.prototype, "page_size", void 0);
__decorate([
    ApiPropertyOptional({ enum: AuditEvent, isArray: true, description: 'Repeat to select several' }),
    IsOptional(),
    Type(() => String),
    IsEnum(AuditEvent, { each: true }),
    __metadata("design:type", Object)
], AuditQueryDto.prototype, "event", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Only events by this profile' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], AuditQueryDto.prototype, "actor_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Inclusive, ISO 8601' }),
    IsOptional(),
    IsISO8601(),
    __metadata("design:type", String)
], AuditQueryDto.prototype, "from", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Inclusive, ISO 8601' }),
    IsOptional(),
    IsISO8601(),
    __metadata("design:type", String)
], AuditQueryDto.prototype, "to", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Only security-relevant events' }),
    IsOptional(),
    Type(() => String),
    __metadata("design:type", String)
], AuditQueryDto.prototype, "security_only", void 0);
export class AuditEntryDto {
    id;
    event;
    actor_id;
    actor_name;
    actor_national_id;
    actor_role;
    detail;
    created_at;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], AuditEntryDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ enum: AuditEvent }),
    __metadata("design:type", String)
], AuditEntryDto.prototype, "event", void 0);
__decorate([
    ApiProperty({ nullable: true, description: 'Null when the actor was deleted, or unknown' }),
    __metadata("design:type", Object)
], AuditEntryDto.prototype, "actor_id", void 0);
__decorate([
    ApiProperty({ nullable: true }),
    __metadata("design:type", Object)
], AuditEntryDto.prototype, "actor_name", void 0);
__decorate([
    ApiProperty({ nullable: true }),
    __metadata("design:type", Object)
], AuditEntryDto.prototype, "actor_national_id", void 0);
__decorate([
    ApiProperty({ nullable: true }),
    __metadata("design:type", Object)
], AuditEntryDto.prototype, "actor_role", void 0);
__decorate([
    ApiProperty({ nullable: true, description: 'Event-specific payload' }),
    __metadata("design:type", Object)
], AuditEntryDto.prototype, "detail", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], AuditEntryDto.prototype, "created_at", void 0);
//# sourceMappingURL=audit.dto.js.map