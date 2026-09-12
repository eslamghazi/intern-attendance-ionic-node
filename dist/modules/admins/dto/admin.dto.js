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
import { IsArray, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, ValidateNested, } from 'class-validator';
import { ADMIN_OPS, ADMIN_PAGES } from '../../../config/constants.js';
/**
 * A grant, validated.
 *
 * This used to be `permissions?: unknown` with no validator on it, so a
 * superadmin could store any JSON at all on an admin's profile — including page
 * names that match nothing, which read at a glance like a granted page that
 * mysteriously never appears.
 */
export class AdminPermissionsDto {
    pages;
    ops;
    pageOps;
}
__decorate([
    ApiProperty({ isArray: true, enum: ADMIN_PAGES }),
    IsArray(),
    IsIn([...ADMIN_PAGES], { each: true }),
    __metadata("design:type", Array)
], AdminPermissionsDto.prototype, "pages", void 0);
__decorate([
    ApiPropertyOptional({ isArray: true, enum: ADMIN_OPS, description: 'Allowed on every granted page' }),
    IsOptional(),
    IsArray(),
    IsIn([...ADMIN_OPS], { each: true }),
    __metadata("design:type", Array)
], AdminPermissionsDto.prototype, "ops", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Allowed on one page specifically; beats `ops`' }),
    IsOptional(),
    IsObject(),
    __metadata("design:type", Object)
], AdminPermissionsDto.prototype, "pageOps", void 0);
export class AdminDto {
    id;
    full_name;
    national_id;
    phone;
    role;
    permissions;
    constructor(data) {
        if (data.id)
            this.id = data.id;
        if (data.full_name)
            this.full_name = data.full_name;
        if (data.national_id)
            this.national_id = data.national_id;
        this.phone = data.phone ?? null;
        if (data.role)
            this.role = data.role;
        this.permissions = data.permissions;
    }
}
__decorate([
    ApiProperty({ example: 'a1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], AdminDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'Dr. Sarah Connor' }),
    __metadata("design:type", String)
], AdminDto.prototype, "full_name", void 0);
__decorate([
    ApiProperty({ example: '29001011234567' }),
    __metadata("design:type", String)
], AdminDto.prototype, "national_id", void 0);
__decorate([
    ApiPropertyOptional({ example: '+201001234567' }),
    __metadata("design:type", Object)
], AdminDto.prototype, "phone", void 0);
__decorate([
    ApiProperty({ example: 'admin' }),
    __metadata("design:type", String)
], AdminDto.prototype, "role", void 0);
__decorate([
    ApiPropertyOptional({ type: AdminPermissionsDto }),
    __metadata("design:type", Object)
], AdminDto.prototype, "permissions", void 0);
export class UpdateAdminDto {
    full_name;
    national_id;
    phone;
    permissions;
}
__decorate([
    ApiProperty({ example: 'Dr. Sarah Connor' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], UpdateAdminDto.prototype, "full_name", void 0);
__decorate([
    ApiProperty({ example: '29001011234567' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], UpdateAdminDto.prototype, "national_id", void 0);
__decorate([
    ApiPropertyOptional({ example: '+201001234567' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], UpdateAdminDto.prototype, "phone", void 0);
__decorate([
    ApiPropertyOptional({ type: AdminPermissionsDto, nullable: true }),
    IsOptional(),
    ValidateNested(),
    Type(() => AdminPermissionsDto),
    __metadata("design:type", Object)
], UpdateAdminDto.prototype, "permissions", void 0);
export class CreateAdminAssignmentDto {
    admin_id;
    group_id;
    branch_id;
}
__decorate([
    ApiProperty({ example: 'a1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    IsUUID(),
    __metadata("design:type", String)
], CreateAdminAssignmentDto.prototype, "admin_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", Object)
], CreateAdminAssignmentDto.prototype, "group_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", Object)
], CreateAdminAssignmentDto.prototype, "branch_id", void 0);
export class AdminAssignmentResponseDto {
    id;
    admin_id;
    group_id;
    branch_id;
}
__decorate([
    ApiProperty({ example: 'as1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' }),
    __metadata("design:type", String)
], AdminAssignmentResponseDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'a1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], AdminAssignmentResponseDto.prototype, "admin_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' }),
    __metadata("design:type", Object)
], AdminAssignmentResponseDto.prototype, "group_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    __metadata("design:type", Object)
], AdminAssignmentResponseDto.prototype, "branch_id", void 0);
//# sourceMappingURL=admin.dto.js.map