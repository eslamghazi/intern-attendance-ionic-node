import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { z } from 'zod';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { MemberFilters, SearchField } from '../../../domain/member/filter.js';

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
  @ApiProperty({ example: 'Interns 2026' })
  name!: string;
}

export class MemberBranchDto {
  @ApiProperty({ example: 'Main Branch' })
  name!: string;
}

export class MemberDto {
  @ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  id!: string;

  @ApiProperty({ example: 'Ahmed Mohamed' })
  full_name!: string;

  @ApiProperty({ example: '29801011234567' })
  national_id!: string;

  @ApiPropertyOptional({ example: '+201001234567' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'ahmed@example.com' })
  email?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatar_url?: string | null;

  @ApiPropertyOptional({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' })
  group_id?: string | null;

  @ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  branch_id?: string | null;

  @ApiProperty({ example: true })
  is_active!: boolean;

  @ApiProperty({ example: false })
  bypass_face!: boolean;

  @ApiProperty({ example: false })
  bypass_location!: boolean;

  @ApiProperty({ example: false })
  bypass_checkout_window!: boolean;

  @ApiPropertyOptional({ example: '2026-09-10' })
  frozen_at?: string | null;

  @ApiProperty({ example: false })
  can_generate_qr!: boolean;

  @ApiProperty({ example: false })
  can_make_roster!: boolean;

  @ApiProperty({ example: false })
  can_reset_face!: boolean;

  @ApiPropertyOptional({ type: MemberGroupDto })
  group?: MemberGroupDto | null;

  @ApiPropertyOptional({ type: MemberBranchDto })
  branch?: MemberBranchDto | null;

  constructor(data: Partial<MemberDto>) {
    if (data.id) this.id = data.id;
    if (data.full_name) this.full_name = data.full_name;
    if (data.national_id) this.national_id = data.national_id;
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

export class CreateMemberInputDto {
  @ApiProperty({ example: '29801011234567' })
  @IsString()
  @IsNotEmpty()
  national_id!: string;

  @ApiProperty({ example: 'Ahmed Mohamed' })
  @IsString()
  @IsNotEmpty()
  full_name!: string;

  @ApiPropertyOptional({ example: '+201001234567' })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ example: 'ahmed@example.com' })
  @IsOptional()
  @IsString()
  email?: string | null;

  @ApiProperty({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' })
  @IsUUID()
  group_id!: string;

  @ApiProperty({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  @IsUUID()
  branch_id!: string;
}

export class CreateMembersBatchDto {
  @ApiProperty({ type: [CreateMemberInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMemberInputDto)
  members!: CreateMemberInputDto[];
}

export class CreateMemberResultItemDto {
  @ApiProperty({ example: '29801011234567' })
  national_id!: string;

  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiPropertyOptional({ example: false })
  updated?: boolean;

  @ApiPropertyOptional()
  error?: string;
}

export class CreateMemberResultDto {
  @ApiProperty({ example: 10 })
  created!: number;

  @ApiProperty({ example: 2 })
  updated!: number;

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ type: [CreateMemberResultItemDto] })
  results!: CreateMemberResultItemDto[];
}


export class UpdateMemberDto {
  @ApiPropertyOptional({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  @IsOptional()
  @IsUUID()
  profile_id?: string;

  @ApiProperty({ example: 'Ahmed Mohamed' })
  @IsString()
  @IsNotEmpty()
  full_name!: string;

  @ApiProperty({ example: '29801011234567' })
  @IsString()
  @IsNotEmpty()
  national_id!: string;

  @ApiPropertyOptional({ example: '+201001234567' })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ example: 'ahmed@example.com' })
  @IsOptional()
  @IsString()
  email?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatar_url?: string | null;

  @ApiPropertyOptional({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' })
  @IsOptional()
  @IsUUID()
  group_id?: string;

  @ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  bypass_face?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  bypass_location?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  bypass_checkout_window?: boolean;

  @ApiPropertyOptional({ example: '2026-09-10' })
  @IsOptional()
  @IsString()
  frozen_at?: string | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  can_generate_qr?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  can_make_roster?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  can_reset_face?: boolean;
}

export class MemberFilterQueryDto implements MemberFilters {
  @ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @ApiPropertyOptional({ example: 'Ahmed' })
  @IsOptional()
  @IsString()
  search?: string = '';

  @ApiPropertyOptional({ enum: ['name', 'national_id', 'code'], default: 'name' })
  @IsOptional()
  @IsString()
  field?: SearchField = 'name';

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  bypass_face?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  bypass_location?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  frozen?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  has_face?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: 'd1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' })
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ example: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  page_size?: number = 50;
}

export class BulkFlagDto extends MemberFilterQueryDto {
  @ApiProperty({ description: 'Flag name to update', enum: ['bypass_face', 'bypass_location'] })
  @IsString()
  @IsNotEmpty()
  flag!: 'bypass_face' | 'bypass_location';

  @ApiProperty({ description: 'New boolean state' })
  @IsBoolean()
  value!: boolean;
}

export class BulkFrozenDto extends MemberFilterQueryDto {
  @ApiPropertyOptional({ description: 'Frozen datetime ISO or null to unfreeze', nullable: true })
  @IsOptional()
  @IsString()
  frozen_at?: string | null;
}

export class BulkUpdateDto extends MemberFilterQueryDto {
  @ApiPropertyOptional({ description: 'Target group ID' })
  @IsOptional()
  @IsUUID()
  group_id?: string;

  @ApiPropertyOptional({ description: 'Target branch ID' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;
}

export class BulkDeleteDto extends MemberFilterQueryDto {}

export class BulkAffectedResponseDto {
  @ApiProperty({ description: 'Number of affected records', example: 10 })
  affected!: number;
}

export class FlagStatsResponseDto {
  @ApiProperty({ description: 'Total matched members', example: 100 })
  total!: number;

  @ApiProperty({ description: 'Members with face bypass enabled', example: 5 })
  bypass_face!: number;

  @ApiProperty({ description: 'Members with location bypass enabled', example: 10 })
  bypass_location!: number;

  @ApiProperty({ description: 'Members with clock frozen', example: 2 })
  frozen!: number;
}

export class MemberProfileNestedDto {
  @ApiProperty({ example: 'Ahmed Mohamed' })
  full_name!: string;

  @ApiProperty({ example: '29801011234567' })
  national_id!: string;

  @ApiPropertyOptional({ example: '+201001234567' })
  phone!: string | null;

  @ApiPropertyOptional({ example: 'ahmed@example.com' })
  email!: string | null;
}

export class MemberDirectoryRowDto {
  @ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  id!: string;

  @ApiProperty({ example: 'p1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  profile_id!: string;

  @ApiProperty({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' })
  group_id!: string;

  @ApiProperty({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  branch_id!: string;

  @ApiProperty({ example: true })
  is_active!: boolean;

  @ApiProperty({ example: false })
  bypass_face!: boolean;

  @ApiProperty({ example: false })
  bypass_location!: boolean;

  @ApiProperty({ example: false })
  bypass_checkout_window!: boolean;

  @ApiPropertyOptional({ example: null })
  frozen_at!: string | null;

  @ApiProperty({ example: false })
  can_generate_qr!: boolean;

  @ApiProperty({ example: false })
  can_make_roster!: boolean;

  @ApiProperty({ example: false })
  can_reset_face!: boolean;

  @ApiProperty({ example: true })
  enrolled!: boolean;

  @ApiPropertyOptional({ example: '2026010107' })
  member_code!: string | null;

  @ApiPropertyOptional({ example: null })
  avatar_url!: string | null;

  @ApiPropertyOptional({ type: MemberProfileNestedDto })
  profile!: MemberProfileNestedDto | null;

  @ApiPropertyOptional({ type: MemberGroupDto })
  group!: MemberGroupDto | null;

  @ApiPropertyOptional({ type: MemberBranchDto })
  branch!: MemberBranchDto | null;
}

export class MemberPageItemDto {
  @ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  member_id!: string;

  @ApiProperty({ example: 'Ahmed Mohamed' })
  full_name!: string;

  @ApiProperty({ example: '29801011234567' })
  national_id!: string;

  @ApiPropertyOptional({ example: '2026010107' })
  member_code!: string | null;
}

export class MemberByProfileDto {
  @ApiPropertyOptional({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  id!: string | null;
}
