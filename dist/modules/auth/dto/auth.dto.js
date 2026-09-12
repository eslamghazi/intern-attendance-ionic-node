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
import { IsString, IsNotEmpty, IsOptional, MinLength, IsUUID, IsArray, ValidateNested, IsIn, } from 'class-validator';
import { Type } from 'class-transformer';
import { Role, STAFF_ROLES } from '../../../common/enums/index.js';
import { PASSWORD_MIN } from '../../../config/constants.js';
export class LoginDto {
    national_id;
    password;
}
__decorate([
    ApiProperty({ description: 'National ID number (login identifier)', example: '29001011234567' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], LoginDto.prototype, "national_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Account password (or national ID if initial)', example: 'Secret!123' }),
    IsString(),
    IsOptional(),
    __metadata("design:type", String)
], LoginDto.prototype, "password", void 0);
export class RefreshTokenDto {
    refresh_token;
}
__decorate([
    ApiProperty({ description: 'Refresh token string', example: 'uuid-refresh-token' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], RefreshTokenDto.prototype, "refresh_token", void 0);
export class LogoutDto {
    refresh_token;
}
__decorate([
    ApiPropertyOptional({ description: 'Refresh token to invalidate', example: 'uuid-refresh-token' }),
    IsString(),
    IsOptional(),
    __metadata("design:type", Object)
], LogoutDto.prototype, "refresh_token", void 0);
export class ChangePasswordDto {
    current;
    new;
}
__decorate([
    ApiProperty({ description: 'Current password', example: 'OldSecret!123' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "current", void 0);
__decorate([
    ApiProperty({ description: `New password (min ${PASSWORD_MIN} characters)`, example: 'NewSecret!456' }),
    IsString(),
    MinLength(PASSWORD_MIN),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "new", void 0);
export class ResetMemberPasswordDto {
    profile_id;
    national_id;
    password;
}
__decorate([
    ApiPropertyOptional({ description: 'Member profile ID (either profile_id or national_id required)' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", String)
], ResetMemberPasswordDto.prototype, "profile_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Member national ID' }),
    IsString(),
    IsOptional(),
    __metadata("design:type", String)
], ResetMemberPasswordDto.prototype, "national_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Optional explicit new password to set' }),
    IsString(),
    IsOptional(),
    __metadata("design:type", String)
], ResetMemberPasswordDto.prototype, "password", void 0);
export class ResetStaffPasswordDto {
    profile_id;
    password;
}
__decorate([
    ApiProperty({ description: 'Staff profile UUID' }),
    IsUUID(),
    IsNotEmpty(),
    __metadata("design:type", String)
], ResetStaffPasswordDto.prototype, "profile_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Optional explicit new password to set' }),
    IsString(),
    IsOptional(),
    __metadata("design:type", String)
], ResetStaffPasswordDto.prototype, "password", void 0);
export class StaffAssignmentInputDto {
    group_id;
    branch_id;
}
__decorate([
    ApiPropertyOptional({ description: 'Target group ID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], StaffAssignmentInputDto.prototype, "group_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Target branch ID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], StaffAssignmentInputDto.prototype, "branch_id", void 0);
export class CreateStaffDto {
    national_id;
    full_name;
    phone;
    password;
    // A superadmin may create another superadmin. The route is superadmin-only
    // (see AuthController.createStaff), so this is the ONLY way one comes into
    // being by hand — an admin cannot promote themselves or anyone else, because
    // no admin can reach the route at all.
    role = Role.ADMIN;
    assignments = [];
}
__decorate([
    ApiProperty({ description: 'National ID number' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], CreateStaffDto.prototype, "national_id", void 0);
__decorate([
    ApiProperty({ description: 'Full legal name' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], CreateStaffDto.prototype, "full_name", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Phone number' }),
    IsString(),
    IsOptional(),
    __metadata("design:type", Object)
], CreateStaffDto.prototype, "phone", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Optional initial password' }),
    IsString(),
    IsOptional(),
    __metadata("design:type", String)
], CreateStaffDto.prototype, "password", void 0);
__decorate([
    ApiPropertyOptional({ enum: STAFF_ROLES, default: Role.ADMIN }),
    IsIn([...STAFF_ROLES]),
    IsOptional(),
    __metadata("design:type", String)
], CreateStaffDto.prototype, "role", void 0);
__decorate([
    ApiPropertyOptional({ type: [StaffAssignmentInputDto] }),
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => StaffAssignmentInputDto),
    IsOptional(),
    __metadata("design:type", Array)
], CreateStaffDto.prototype, "assignments", void 0);
export class LoginProfileDto {
    id;
    full_name;
}
__decorate([
    ApiProperty({ description: 'Profile UUID' }),
    __metadata("design:type", String)
], LoginProfileDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ description: 'Full name' }),
    __metadata("design:type", String)
], LoginProfileDto.prototype, "full_name", void 0);
export class LoginResultDto {
    access_token;
    refresh_token;
    expires_in;
    token_type = 'Bearer';
    role;
    profile;
    constructor(data) {
        Object.assign(this, data);
    }
}
__decorate([
    ApiProperty({ description: 'Short-lived JWT access token' }),
    __metadata("design:type", String)
], LoginResultDto.prototype, "access_token", void 0);
__decorate([
    ApiProperty({ description: 'Opaque refresh token' }),
    __metadata("design:type", String)
], LoginResultDto.prototype, "refresh_token", void 0);
__decorate([
    ApiProperty({ description: 'Access token expiration in seconds', example: 900 }),
    __metadata("design:type", Number)
], LoginResultDto.prototype, "expires_in", void 0);
__decorate([
    ApiProperty({ description: 'Token type', example: 'Bearer' }),
    __metadata("design:type", String)
], LoginResultDto.prototype, "token_type", void 0);
__decorate([
    ApiProperty({ description: 'User role', example: 'superadmin' }),
    __metadata("design:type", String)
], LoginResultDto.prototype, "role", void 0);
__decorate([
    ApiProperty({ type: LoginProfileDto }),
    __metadata("design:type", LoginProfileDto)
], LoginResultDto.prototype, "profile", void 0);
//# sourceMappingURL=auth.dto.js.map