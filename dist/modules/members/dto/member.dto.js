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
import { MAX_PAGE_SIZE } from '../../../domain/member/filter.js';
import { Type, Transform } from 'class-transformer';
import { z } from 'zod';
import { IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
export const filterQuery = z.object({
    branchId: z.string().uuid().nullish(),
    search: z.string().default(''),
    field: z.enum(['name', 'national_id', 'code']).default('name'),
    bypass_face: z.boolean().optional(),
    bypass_location: z.boolean().optional(),
    frozen: z.boolean().optional(),
    has_face: z.boolean().optional(),
    is_active: z.boolean().optional(),
    departmentId: z.string().uuid().nullish(),
    year: z.coerce.number().int().optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
});
export class MemberGroupDto {
    name;
}
__decorate([
    ApiProperty({ example: 'Interns 2026' }),
    __metadata("design:type", String)
], MemberGroupDto.prototype, "name", void 0);
export class MemberBranchDto {
    name;
}
__decorate([
    ApiProperty({ example: 'Main Branch' }),
    __metadata("design:type", String)
], MemberBranchDto.prototype, "name", void 0);
export class MemberDto {
    id;
    full_name;
    national_id;
    phone;
    email;
    avatar_url;
    group_id;
    branch_id;
    is_active;
    bypass_face;
    bypass_location;
    bypass_checkout_window;
    frozen_at;
    can_generate_qr;
    can_make_roster;
    can_reset_face;
    group;
    branch;
    constructor(data) {
        if (data.id)
            this.id = data.id;
        if (data.full_name)
            this.full_name = data.full_name;
        if (data.national_id)
            this.national_id = data.national_id;
        this.phone = data.phone ?? null;
        this.email = data.email ?? null;
        this.avatar_url = data.avatar_url ?? null;
        this.group_id = data.group_id ?? null;
        this.branch_id = data.branch_id ?? null;
        this.is_active = data.is_active ?? true;
        this.bypass_face = data.bypass_face ?? false;
        this.bypass_location = data.bypass_location ?? false;
        this.bypass_checkout_window = data.bypass_checkout_window ?? false;
        this.frozen_at = data.frozen_at ?? null;
        this.can_generate_qr = data.can_generate_qr ?? false;
        this.can_make_roster = data.can_make_roster ?? false;
        this.can_reset_face = data.can_reset_face ?? false;
        this.group = data.group ?? null;
        this.branch = data.branch ?? null;
    }
}
__decorate([
    ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], MemberDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'Ahmed Mohamed' }),
    __metadata("design:type", String)
], MemberDto.prototype, "full_name", void 0);
__decorate([
    ApiProperty({ example: '29801011234567' }),
    __metadata("design:type", String)
], MemberDto.prototype, "national_id", void 0);
__decorate([
    ApiPropertyOptional({ example: '+201001234567' }),
    __metadata("design:type", Object)
], MemberDto.prototype, "phone", void 0);
__decorate([
    ApiPropertyOptional({ example: 'ahmed@example.com' }),
    __metadata("design:type", Object)
], MemberDto.prototype, "email", void 0);
__decorate([
    ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' }),
    __metadata("design:type", Object)
], MemberDto.prototype, "avatar_url", void 0);
__decorate([
    ApiPropertyOptional({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' }),
    __metadata("design:type", Object)
], MemberDto.prototype, "group_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    __metadata("design:type", Object)
], MemberDto.prototype, "branch_id", void 0);
__decorate([
    ApiProperty({ example: true }),
    __metadata("design:type", Boolean)
], MemberDto.prototype, "is_active", void 0);
__decorate([
    ApiProperty({ example: false }),
    __metadata("design:type", Boolean)
], MemberDto.prototype, "bypass_face", void 0);
__decorate([
    ApiProperty({ example: false }),
    __metadata("design:type", Boolean)
], MemberDto.prototype, "bypass_location", void 0);
__decorate([
    ApiProperty({ example: false }),
    __metadata("design:type", Boolean)
], MemberDto.prototype, "bypass_checkout_window", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10' }),
    __metadata("design:type", Object)
], MemberDto.prototype, "frozen_at", void 0);
__decorate([
    ApiProperty({ example: false }),
    __metadata("design:type", Boolean)
], MemberDto.prototype, "can_generate_qr", void 0);
__decorate([
    ApiProperty({ example: false }),
    __metadata("design:type", Boolean)
], MemberDto.prototype, "can_make_roster", void 0);
__decorate([
    ApiProperty({ example: false }),
    __metadata("design:type", Boolean)
], MemberDto.prototype, "can_reset_face", void 0);
__decorate([
    ApiPropertyOptional({ type: MemberGroupDto }),
    __metadata("design:type", Object)
], MemberDto.prototype, "group", void 0);
__decorate([
    ApiPropertyOptional({ type: MemberBranchDto }),
    __metadata("design:type", Object)
], MemberDto.prototype, "branch", void 0);
export class CreateMemberInputDto {
    national_id;
    full_name;
    phone;
    email;
    group_id;
    branch_id;
}
__decorate([
    ApiProperty({ example: '29801011234567' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], CreateMemberInputDto.prototype, "national_id", void 0);
__decorate([
    ApiProperty({ example: 'Ahmed Mohamed' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], CreateMemberInputDto.prototype, "full_name", void 0);
__decorate([
    ApiPropertyOptional({ example: '+201001234567' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], CreateMemberInputDto.prototype, "phone", void 0);
__decorate([
    ApiPropertyOptional({ example: 'ahmed@example.com' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], CreateMemberInputDto.prototype, "email", void 0);
__decorate([
    ApiProperty({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' }),
    IsUUID(),
    __metadata("design:type", String)
], CreateMemberInputDto.prototype, "group_id", void 0);
__decorate([
    ApiProperty({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    IsUUID(),
    __metadata("design:type", String)
], CreateMemberInputDto.prototype, "branch_id", void 0);
export class CreateMembersBatchDto {
    members;
}
__decorate([
    ApiProperty({ type: [CreateMemberInputDto] }),
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => CreateMemberInputDto),
    __metadata("design:type", Array)
], CreateMembersBatchDto.prototype, "members", void 0);
export class CreateMemberResultItemDto {
    national_id;
    ok;
    updated;
    error;
}
__decorate([
    ApiProperty({ example: '29801011234567' }),
    __metadata("design:type", String)
], CreateMemberResultItemDto.prototype, "national_id", void 0);
__decorate([
    ApiProperty({ example: true }),
    __metadata("design:type", Boolean)
], CreateMemberResultItemDto.prototype, "ok", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Boolean)
], CreateMemberResultItemDto.prototype, "updated", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", String)
], CreateMemberResultItemDto.prototype, "error", void 0);
export class CreateMemberResultDto {
    created;
    updated;
    total;
    results;
}
__decorate([
    ApiProperty({ example: 10 }),
    __metadata("design:type", Number)
], CreateMemberResultDto.prototype, "created", void 0);
__decorate([
    ApiProperty({ example: 2 }),
    __metadata("design:type", Number)
], CreateMemberResultDto.prototype, "updated", void 0);
__decorate([
    ApiProperty({ example: 12 }),
    __metadata("design:type", Number)
], CreateMemberResultDto.prototype, "total", void 0);
__decorate([
    ApiProperty({ type: [CreateMemberResultItemDto] }),
    __metadata("design:type", Array)
], CreateMemberResultDto.prototype, "results", void 0);
export class UpdateMemberDto {
    // REQUIRED. The route's `:id` is the member; the person's name, national ID
    // and picture live on the profile, which is a different row with a different
    // id. Marked optional, an omitted one reached the repository as `undefined`
    // and became `where id = undefined` — a query that matches nobody, after
    // which the route still answered `{ ok: true }`.
    profile_id;
    full_name;
    national_id;
    phone;
    email;
    avatar_url;
    group_id;
    branch_id;
    is_active;
    bypass_face;
    bypass_location;
    bypass_checkout_window;
    frozen_at;
    can_generate_qr;
    can_make_roster;
    can_reset_face;
}
__decorate([
    ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    IsUUID(),
    __metadata("design:type", String)
], UpdateMemberDto.prototype, "profile_id", void 0);
__decorate([
    ApiProperty({ example: 'Ahmed Mohamed' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], UpdateMemberDto.prototype, "full_name", void 0);
__decorate([
    ApiProperty({ example: '29801011234567' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], UpdateMemberDto.prototype, "national_id", void 0);
__decorate([
    ApiPropertyOptional({ example: '+201001234567' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], UpdateMemberDto.prototype, "phone", void 0);
__decorate([
    ApiPropertyOptional({ example: 'ahmed@example.com' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], UpdateMemberDto.prototype, "email", void 0);
__decorate([
    ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], UpdateMemberDto.prototype, "avatar_url", void 0);
__decorate([
    ApiPropertyOptional({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], UpdateMemberDto.prototype, "group_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], UpdateMemberDto.prototype, "branch_id", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateMemberDto.prototype, "is_active", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateMemberDto.prototype, "bypass_face", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateMemberDto.prototype, "bypass_location", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateMemberDto.prototype, "bypass_checkout_window", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], UpdateMemberDto.prototype, "frozen_at", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateMemberDto.prototype, "can_generate_qr", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateMemberDto.prototype, "can_make_roster", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateMemberDto.prototype, "can_reset_face", void 0);
export class MemberFilterQueryDto {
    branchId;
    search = '';
    field = 'name';
    bypass_face;
    bypass_location;
    frozen;
    has_face;
    is_active;
    departmentId;
    year;
    month;
    page = 1;
    page_size = 50;
    /**
     * Which file an /export route should produce. Ignored by the listing routes,
     * and declared here because every export query extends this one — the three
     * of them cannot then disagree about the parameter's name or its default.
     */
    format;
}
__decorate([
    ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", Object)
], MemberFilterQueryDto.prototype, "branchId", void 0);
__decorate([
    ApiPropertyOptional({ example: 'Ahmed' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], MemberFilterQueryDto.prototype, "search", void 0);
__decorate([
    ApiPropertyOptional({ enum: ['name', 'national_id', 'code'], default: 'name' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], MemberFilterQueryDto.prototype, "field", void 0);
__decorate([
    ApiPropertyOptional(),
    IsOptional(),
    Transform(({ value }) => value === true || value === 'true'),
    IsBoolean(),
    __metadata("design:type", Boolean)
], MemberFilterQueryDto.prototype, "bypass_face", void 0);
__decorate([
    ApiPropertyOptional(),
    IsOptional(),
    Transform(({ value }) => value === true || value === 'true'),
    IsBoolean(),
    __metadata("design:type", Boolean)
], MemberFilterQueryDto.prototype, "bypass_location", void 0);
__decorate([
    ApiPropertyOptional(),
    IsOptional(),
    Transform(({ value }) => value === true || value === 'true'),
    IsBoolean(),
    __metadata("design:type", Boolean)
], MemberFilterQueryDto.prototype, "frozen", void 0);
__decorate([
    ApiPropertyOptional(),
    IsOptional(),
    Transform(({ value }) => value === true || value === 'true'),
    IsBoolean(),
    __metadata("design:type", Boolean)
], MemberFilterQueryDto.prototype, "has_face", void 0);
__decorate([
    ApiPropertyOptional(),
    IsOptional(),
    Transform(({ value }) => value === true || value === 'true'),
    IsBoolean(),
    __metadata("design:type", Boolean)
], MemberFilterQueryDto.prototype, "is_active", void 0);
__decorate([
    ApiPropertyOptional({ example: 'd1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", Object)
], MemberFilterQueryDto.prototype, "departmentId", void 0);
__decorate([
    ApiPropertyOptional({ example: 2026 }),
    IsOptional(),
    Type(() => Number),
    IsInt(),
    __metadata("design:type", Number)
], MemberFilterQueryDto.prototype, "year", void 0);
__decorate([
    ApiPropertyOptional({ example: 9 }),
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(12),
    __metadata("design:type", Number)
], MemberFilterQueryDto.prototype, "month", void 0);
__decorate([
    ApiPropertyOptional({ default: 1, minimum: 1 }),
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], MemberFilterQueryDto.prototype, "page", void 0);
__decorate([
    ApiPropertyOptional({ default: 50, minimum: 1, maximum: MAX_PAGE_SIZE }),
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(MAX_PAGE_SIZE),
    __metadata("design:type", Number)
], MemberFilterQueryDto.prototype, "page_size", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Export format', enum: ['xlsx', 'pdf'], default: 'xlsx' }),
    IsOptional(),
    IsIn(['xlsx', 'pdf']),
    __metadata("design:type", String)
], MemberFilterQueryDto.prototype, "format", void 0);
export class BulkFlagDto extends MemberFilterQueryDto {
    flag;
    value;
}
__decorate([
    ApiProperty({ description: 'Flag name to update', enum: ['bypass_face', 'bypass_location'] }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], BulkFlagDto.prototype, "flag", void 0);
__decorate([
    ApiProperty({ description: 'New boolean state' }),
    IsBoolean(),
    __metadata("design:type", Boolean)
], BulkFlagDto.prototype, "value", void 0);
export class BulkFrozenDto extends MemberFilterQueryDto {
    frozen_at;
}
__decorate([
    ApiPropertyOptional({ description: 'Frozen datetime ISO or null to unfreeze', nullable: true }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], BulkFrozenDto.prototype, "frozen_at", void 0);
export class BulkUpdateDto extends MemberFilterQueryDto {
    group_id;
    branch_id;
}
__decorate([
    ApiPropertyOptional({ description: 'Target group ID' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], BulkUpdateDto.prototype, "group_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Target branch ID' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], BulkUpdateDto.prototype, "branch_id", void 0);
export class BulkDeleteDto extends MemberFilterQueryDto {
}
export class BulkAffectedResponseDto {
    affected;
}
__decorate([
    ApiProperty({ description: 'Number of affected records', example: 10 }),
    __metadata("design:type", Number)
], BulkAffectedResponseDto.prototype, "affected", void 0);
export class FlagStatsResponseDto {
    total;
    bypass_face;
    bypass_location;
    frozen;
}
__decorate([
    ApiProperty({ description: 'Total matched members', example: 100 }),
    __metadata("design:type", Number)
], FlagStatsResponseDto.prototype, "total", void 0);
__decorate([
    ApiProperty({ description: 'Members with face bypass enabled', example: 5 }),
    __metadata("design:type", Number)
], FlagStatsResponseDto.prototype, "bypass_face", void 0);
__decorate([
    ApiProperty({ description: 'Members with location bypass enabled', example: 10 }),
    __metadata("design:type", Number)
], FlagStatsResponseDto.prototype, "bypass_location", void 0);
__decorate([
    ApiProperty({ description: 'Members with clock frozen', example: 2 }),
    __metadata("design:type", Number)
], FlagStatsResponseDto.prototype, "frozen", void 0);
export class MemberProfileNestedDto {
    full_name;
    national_id;
    phone;
    email;
}
__decorate([
    ApiProperty({ example: 'Ahmed Mohamed' }),
    __metadata("design:type", String)
], MemberProfileNestedDto.prototype, "full_name", void 0);
__decorate([
    ApiProperty({ example: '29801011234567' }),
    __metadata("design:type", String)
], MemberProfileNestedDto.prototype, "national_id", void 0);
__decorate([
    ApiPropertyOptional({ example: '+201001234567' }),
    __metadata("design:type", Object)
], MemberProfileNestedDto.prototype, "phone", void 0);
__decorate([
    ApiPropertyOptional({ example: 'ahmed@example.com' }),
    __metadata("design:type", Object)
], MemberProfileNestedDto.prototype, "email", void 0);
export class MemberDirectoryRowDto {
    id;
    profile_id;
    group_id;
    branch_id;
    is_active;
    bypass_face;
    bypass_location;
    bypass_checkout_window;
    frozen_at;
    can_generate_qr;
    can_make_roster;
    can_reset_face;
    enrolled;
    member_code;
    avatar_url;
    profile;
    group;
    branch;
}
__decorate([
    ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], MemberDirectoryRowDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'p1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], MemberDirectoryRowDto.prototype, "profile_id", void 0);
__decorate([
    ApiProperty({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' }),
    __metadata("design:type", String)
], MemberDirectoryRowDto.prototype, "group_id", void 0);
__decorate([
    ApiProperty({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    __metadata("design:type", String)
], MemberDirectoryRowDto.prototype, "branch_id", void 0);
__decorate([
    ApiProperty({ example: true }),
    __metadata("design:type", Boolean)
], MemberDirectoryRowDto.prototype, "is_active", void 0);
__decorate([
    ApiProperty({ example: false }),
    __metadata("design:type", Boolean)
], MemberDirectoryRowDto.prototype, "bypass_face", void 0);
__decorate([
    ApiProperty({ example: false }),
    __metadata("design:type", Boolean)
], MemberDirectoryRowDto.prototype, "bypass_location", void 0);
__decorate([
    ApiProperty({ example: false }),
    __metadata("design:type", Boolean)
], MemberDirectoryRowDto.prototype, "bypass_checkout_window", void 0);
__decorate([
    ApiPropertyOptional({ example: null }),
    __metadata("design:type", Object)
], MemberDirectoryRowDto.prototype, "frozen_at", void 0);
__decorate([
    ApiProperty({ example: false }),
    __metadata("design:type", Boolean)
], MemberDirectoryRowDto.prototype, "can_generate_qr", void 0);
__decorate([
    ApiProperty({ example: false }),
    __metadata("design:type", Boolean)
], MemberDirectoryRowDto.prototype, "can_make_roster", void 0);
__decorate([
    ApiProperty({ example: false }),
    __metadata("design:type", Boolean)
], MemberDirectoryRowDto.prototype, "can_reset_face", void 0);
__decorate([
    ApiProperty({ example: true }),
    __metadata("design:type", Boolean)
], MemberDirectoryRowDto.prototype, "enrolled", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026010107' }),
    __metadata("design:type", Object)
], MemberDirectoryRowDto.prototype, "member_code", void 0);
__decorate([
    ApiPropertyOptional({ example: null }),
    __metadata("design:type", Object)
], MemberDirectoryRowDto.prototype, "avatar_url", void 0);
__decorate([
    ApiPropertyOptional({ type: MemberProfileNestedDto }),
    __metadata("design:type", Object)
], MemberDirectoryRowDto.prototype, "profile", void 0);
__decorate([
    ApiPropertyOptional({ type: MemberGroupDto }),
    __metadata("design:type", Object)
], MemberDirectoryRowDto.prototype, "group", void 0);
__decorate([
    ApiPropertyOptional({ type: MemberBranchDto }),
    __metadata("design:type", Object)
], MemberDirectoryRowDto.prototype, "branch", void 0);
export class MemberPageItemDto {
    member_id;
    full_name;
    national_id;
    member_code;
}
__decorate([
    ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], MemberPageItemDto.prototype, "member_id", void 0);
__decorate([
    ApiProperty({ example: 'Ahmed Mohamed' }),
    __metadata("design:type", String)
], MemberPageItemDto.prototype, "full_name", void 0);
__decorate([
    ApiProperty({ example: '29801011234567' }),
    __metadata("design:type", String)
], MemberPageItemDto.prototype, "national_id", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026010107' }),
    __metadata("design:type", Object)
], MemberPageItemDto.prototype, "member_code", void 0);
export class MemberByProfileDto {
    id;
}
__decorate([
    ApiPropertyOptional({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", Object)
], MemberByProfileDto.prototype, "id", void 0);
//# sourceMappingURL=member.dto.js.map