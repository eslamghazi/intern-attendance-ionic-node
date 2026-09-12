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
import { IsUUID, IsOptional, IsInt, Min, IsNotEmpty, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PresenceDecision } from '../../../common/enums/index.js';
export class CreatePresenceCheckDto {
    branch_id;
    group_id;
    department_id;
    shift_id;
    deadline_minutes = 10;
}
__decorate([
    ApiPropertyOptional({ description: 'Target branch UUID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], CreatePresenceCheckDto.prototype, "branch_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Target group UUID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], CreatePresenceCheckDto.prototype, "group_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Target department UUID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], CreatePresenceCheckDto.prototype, "department_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Target shift UUID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], CreatePresenceCheckDto.prototype, "shift_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Response deadline in minutes', default: 10, example: 10 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    IsOptional(),
    __metadata("design:type", Number)
], CreatePresenceCheckDto.prototype, "deadline_minutes", void 0);
export class ConfirmPresenceByAdminDto {
    member_id;
}
__decorate([
    ApiProperty({ description: 'Target member UUID' }),
    IsUUID(),
    IsNotEmpty(),
    __metadata("design:type", String)
], ConfirmPresenceByAdminDto.prototype, "member_id", void 0);
export class ResolvePresenceCheckDto {
    decision = PresenceDecision.RESOLVED;
}
__decorate([
    ApiPropertyOptional({ description: 'Resolution decision', enum: PresenceDecision, default: PresenceDecision.RESOLVED }),
    IsIn(Object.values(PresenceDecision)),
    IsOptional(),
    __metadata("design:type", String)
], ResolvePresenceCheckDto.prototype, "decision", void 0);
export class ConfirmPresenceByMemberDto {
    check_id;
}
__decorate([
    ApiProperty({ description: 'Presence check UUID' }),
    IsUUID(),
    IsNotEmpty(),
    __metadata("design:type", String)
], ConfirmPresenceByMemberDto.prototype, "check_id", void 0);
export class CreatePresenceCheckResponseDto {
    ok;
    check_id;
    target_count;
    deadline;
    skipped;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", Boolean)
], CreatePresenceCheckResponseDto.prototype, "ok", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", String)
], CreatePresenceCheckResponseDto.prototype, "check_id", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", Number)
], CreatePresenceCheckResponseDto.prototype, "target_count", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", String)
], CreatePresenceCheckResponseDto.prototype, "deadline", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", Boolean)
], CreatePresenceCheckResponseDto.prototype, "skipped", void 0);
export class PresencePendingMemberDto {
    member_id;
    full_name;
}
__decorate([
    ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], PresencePendingMemberDto.prototype, "member_id", void 0);
__decorate([
    ApiProperty({ example: 'Ahmed Mohamed' }),
    __metadata("design:type", String)
], PresencePendingMemberDto.prototype, "full_name", void 0);
export class PresenceCheckRowDto {
    id;
    created_by;
    branch_id;
    group_id;
    department_id;
    shift_id;
    date;
    deadline;
    target_member_ids;
    status;
    decision;
    created_at;
    resolved_at;
    target_count;
    confirmed_count;
    past_deadline;
    pending;
}
__decorate([
    ApiProperty({ example: 'c1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], PresenceCheckRowDto.prototype, "id", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", Object)
], PresenceCheckRowDto.prototype, "created_by", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", Object)
], PresenceCheckRowDto.prototype, "branch_id", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", Object)
], PresenceCheckRowDto.prototype, "group_id", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", Object)
], PresenceCheckRowDto.prototype, "department_id", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", Object)
], PresenceCheckRowDto.prototype, "shift_id", void 0);
__decorate([
    ApiProperty({ example: '2026-09-10' }),
    __metadata("design:type", String)
], PresenceCheckRowDto.prototype, "date", void 0);
__decorate([
    ApiProperty({ example: '2026-09-10T08:15:00.000Z' }),
    __metadata("design:type", String)
], PresenceCheckRowDto.prototype, "deadline", void 0);
__decorate([
    ApiProperty({ type: [String] }),
    __metadata("design:type", Array)
], PresenceCheckRowDto.prototype, "target_member_ids", void 0);
__decorate([
    ApiProperty({ example: 'open' }),
    __metadata("design:type", String)
], PresenceCheckRowDto.prototype, "status", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", Object)
], PresenceCheckRowDto.prototype, "decision", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Object)
], PresenceCheckRowDto.prototype, "created_at", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", Object)
], PresenceCheckRowDto.prototype, "resolved_at", void 0);
__decorate([
    ApiProperty({ example: 25 }),
    __metadata("design:type", Number)
], PresenceCheckRowDto.prototype, "target_count", void 0);
__decorate([
    ApiProperty({ example: 18 }),
    __metadata("design:type", Number)
], PresenceCheckRowDto.prototype, "confirmed_count", void 0);
__decorate([
    ApiProperty({ example: false }),
    __metadata("design:type", Boolean)
], PresenceCheckRowDto.prototype, "past_deadline", void 0);
__decorate([
    ApiProperty({ type: [PresencePendingMemberDto] }),
    __metadata("design:type", Array)
], PresenceCheckRowDto.prototype, "pending", void 0);
export class PresenceChecksResponseDto {
    checks;
}
__decorate([
    ApiProperty({ type: [PresenceCheckRowDto] }),
    __metadata("design:type", Array)
], PresenceChecksResponseDto.prototype, "checks", void 0);
export class ResolveCheckResponseDto {
    ok;
    decision;
}
__decorate([
    ApiProperty({ example: true }),
    __metadata("design:type", Boolean)
], ResolveCheckResponseDto.prototype, "ok", void 0);
__decorate([
    ApiProperty({ example: 'keep' }),
    __metadata("design:type", String)
], ResolveCheckResponseDto.prototype, "decision", void 0);
export class PendingCheckItemDto {
    check_id;
    deadline;
}
__decorate([
    ApiProperty({ example: 'c1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], PendingCheckItemDto.prototype, "check_id", void 0);
__decorate([
    ApiProperty({ example: '2026-09-10T08:15:00.000Z' }),
    __metadata("design:type", String)
], PendingCheckItemDto.prototype, "deadline", void 0);
export class PendingPresenceResponseDto {
    pending;
}
__decorate([
    ApiPropertyOptional({ type: PendingCheckItemDto, nullable: true }),
    __metadata("design:type", Object)
], PendingPresenceResponseDto.prototype, "pending", void 0);
export class ActionSuccessResponseDto {
    ok;
}
__decorate([
    ApiProperty({ example: true }),
    __metadata("design:type", Boolean)
], ActionSuccessResponseDto.prototype, "ok", void 0);
//# sourceMappingURL=presence.dto.js.map