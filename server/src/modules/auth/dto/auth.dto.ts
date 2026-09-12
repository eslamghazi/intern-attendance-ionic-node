import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  IsUUID,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '../../../common/enums/index.js';
import { PASSWORD_MIN } from '../../../config/constants.js';

export class LoginDto {
  @ApiProperty({ description: 'National ID number (login identifier)', example: '29001011234567' })
  @IsString()
  @IsNotEmpty()
  national_id!: string;

  @ApiPropertyOptional({ description: 'Account password (or national ID if initial)', example: 'Secret!123' })
  @IsString()
  @IsOptional()
  password?: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token string', example: 'uuid-refresh-token' })
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token to invalidate', example: 'uuid-refresh-token' })
  @IsString()
  @IsOptional()
  refresh_token?: string | null;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password', example: 'OldSecret!123' })
  @IsString()
  @IsNotEmpty()
  current!: string;

  @ApiProperty({ description: `New password (min ${PASSWORD_MIN} characters)`, example: 'NewSecret!456' })
  @IsString()
  @MinLength(PASSWORD_MIN)
  new!: string;
}

export class ResetMemberPasswordDto {
  @ApiPropertyOptional({ description: 'Member profile ID (either profile_id or national_id required)' })
  @IsUUID()
  @IsOptional()
  profile_id?: string;

  @ApiPropertyOptional({ description: 'Member national ID' })
  @IsString()
  @IsOptional()
  national_id?: string;

  @ApiPropertyOptional({ description: 'Optional explicit new password to set' })
  @IsString()
  @IsOptional()
  password?: string;
}

export class ResetStaffPasswordDto {
  @ApiProperty({ description: 'Staff profile UUID' })
  @IsUUID()
  @IsNotEmpty()
  profile_id!: string;

  @ApiPropertyOptional({ description: 'Optional explicit new password to set' })
  @IsString()
  @IsOptional()
  password?: string;
}

export class StaffAssignmentInputDto {
  @ApiPropertyOptional({ description: 'Target group ID' })
  @IsUUID()
  @IsOptional()
  group_id?: string | null;

  @ApiPropertyOptional({ description: 'Target branch ID' })
  @IsUUID()
  @IsOptional()
  branch_id?: string | null;
}

export class CreateStaffDto {
  @ApiProperty({ description: 'National ID number' })
  @IsString()
  @IsNotEmpty()
  national_id!: string;

  @ApiProperty({ description: 'Full legal name' })
  @IsString()
  @IsNotEmpty()
  full_name!: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string | null;

  @ApiPropertyOptional({ description: 'Optional initial password' })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ enum: [Role.ADMIN], default: Role.ADMIN })
  @IsIn([Role.ADMIN])
  @IsOptional()
  role?: Role = Role.ADMIN;

  @ApiPropertyOptional({ type: [StaffAssignmentInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StaffAssignmentInputDto)
  @IsOptional()
  assignments?: StaffAssignmentInputDto[] = [];
}

export class LoginProfileDto {
  @ApiProperty({ description: 'Profile UUID' })
  id!: string;

  @ApiProperty({ description: 'Full name' })
  full_name!: string;
}

export class LoginResultDto {
  @ApiProperty({ description: 'Short-lived JWT access token' })
  access_token!: string;

  @ApiProperty({ description: 'Opaque refresh token' })
  refresh_token!: string;

  @ApiProperty({ description: 'Access token expiration in seconds', example: 900 })
  expires_in!: number;

  @ApiProperty({ description: 'Token type', example: 'Bearer' })
  token_type: string = 'Bearer';

  @ApiProperty({ description: 'User role', example: 'superadmin' })
  role!: string;

  @ApiProperty({ type: LoginProfileDto })
  profile!: LoginProfileDto;

  constructor(data: Partial<LoginResultDto>) {
    Object.assign(this, data);
  }
}
