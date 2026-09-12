import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ADMIN_OPS, ADMIN_PAGES } from '../../../config/constants.js';
import type { AdminOp, AdminPage, AdminPermissions } from '../../../domain/identity/types.js';

/**
 * A grant, validated.
 *
 * This used to be `permissions?: unknown` with no validator on it, so a
 * superadmin could store any JSON at all on an admin's profile — including page
 * names that match nothing, which read at a glance like a granted page that
 * mysteriously never appears.
 */
export class AdminPermissionsDto implements AdminPermissions {
  @ApiProperty({ isArray: true, enum: ADMIN_PAGES })
  @IsArray()
  @IsIn([...ADMIN_PAGES], { each: true })
  pages!: AdminPage[];

  @ApiPropertyOptional({ isArray: true, enum: ADMIN_OPS, description: 'Allowed on every granted page' })
  @IsOptional()
  @IsArray()
  @IsIn([...ADMIN_OPS], { each: true })
  ops?: AdminOp[];

  @ApiPropertyOptional({ description: 'Allowed on one page specifically; beats `ops`' })
  @IsOptional()
  @IsObject()
  pageOps?: Partial<Record<AdminPage, AdminOp[]>>;
}

export class AdminDto {
  @ApiProperty({ example: 'a1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  id!: string;

  @ApiProperty({ example: 'Dr. Sarah Connor' })
  full_name!: string;

  @ApiProperty({ example: '29001011234567' })
  national_id!: string;

  @ApiPropertyOptional({ example: '+201001234567' })
  phone?: string | null;

  @ApiProperty({ example: 'admin' })
  role!: string;

  @ApiPropertyOptional({ type: AdminPermissionsDto })
  permissions?: AdminPermissions | null;

  constructor(data: Partial<AdminDto>) {
    if (data.id) this.id = data.id;
    if (data.full_name) this.full_name = data.full_name;
    if (data.national_id) this.national_id = data.national_id;
    this.phone = data.phone ?? null;
    if (data.role) this.role = data.role;
    this.permissions = data.permissions;
  }
}

export class UpdateAdminDto {
  @ApiProperty({ example: 'Dr. Sarah Connor' })
  @IsString()
  @IsNotEmpty()
  full_name!: string;

  @ApiProperty({ example: '29001011234567' })
  @IsString()
  @IsNotEmpty()
  national_id!: string;

  @ApiPropertyOptional({ example: '+201001234567' })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ type: AdminPermissionsDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdminPermissionsDto)
  permissions?: AdminPermissions | null;
}

export class CreateAdminAssignmentDto {
  @ApiProperty({ example: 'a1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  @IsUUID()
  admin_id!: string;

  @ApiPropertyOptional({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' })
  @IsOptional()
  @IsUUID()
  group_id?: string | null;

  @ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  @IsOptional()
  @IsUUID()
  branch_id?: string | null;
}

export class AdminAssignmentResponseDto {
  @ApiProperty({ example: 'as1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' })
  id!: string;

  @ApiProperty({ example: 'a1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  admin_id!: string;

  @ApiPropertyOptional({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' })
  group_id?: string | null;

  @ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  branch_id?: string | null;
}
