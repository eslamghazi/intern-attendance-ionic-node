import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import type { JsonValue } from '../../../common/json.types.js';

/* --- Institutions --- */

export class CreateInstitutionDto {
  @ApiProperty({ example: 'Cairo University', description: 'Institution name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 101, default: 0, description: 'Institution numeric code' })
  @IsOptional()
  @IsInt()
  code?: number = 0;
}

export class UpdateInstitutionDto {
  @ApiProperty({ example: 'Cairo University - Updated' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 102 })
  @IsOptional()
  @IsInt()
  code?: number;
}

export class InstitutionResponseDto {
  @ApiProperty({ example: 'c8d0e513-5b8b-4c74-8b6b-1a5ec4c74567' })
  id!: string;

  @ApiProperty({ example: 'Cairo University' })
  name!: string;

  @ApiProperty({ example: 101 })
  code!: number;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  created_at?: string | null;
}

/* --- Branches --- */

export class CreateBranchDto {
  @ApiProperty({ example: 'Main Branch' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: '123 Nile St, Giza' })
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiProperty({ example: 30.0444 })
  @IsNumber()
  latitude!: number;

  @ApiProperty({ example: 31.2357 })
  @IsNumber()
  longitude!: number;

  @ApiProperty({ example: 100, description: 'Geofence radius in meters' })
  @IsInt()
  radius_meters!: number;

  // JsonValue[], not LatLng[]: this is what a client SENT, and it has not been
  // checked yet. CatalogService.validatedRing is what turns it into a ring, and
  // it is the only thing allowed to say it is one.
  @ApiPropertyOptional({ description: 'Optional polygon area coordinates', type: 'array', items: { type: 'object' } })
  @IsOptional()
  @IsArray()
  area_coords?: JsonValue[] | null;

  @ApiPropertyOptional({ example: 'c8d0e513-5b8b-4c74-8b6b-1a5ec4c74567' })
  @IsOptional()
  @IsUUID()
  institution_id?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  bypass_face?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  bypass_location?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  bypass_checkout_window?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  require_qr?: boolean = false;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  qr_enabled?: boolean = true;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  block_checkin?: boolean = false;
}

export class UpdateBranchDto extends CreateBranchDto {}

export class BranchResponseDto {
  @ApiProperty({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  id!: string;

  @ApiProperty({ example: 'Main Branch' })
  name!: string;

  @ApiPropertyOptional({ example: '123 Nile St, Giza' })
  address?: string | null;

  @ApiProperty({ example: 30.0444 })
  latitude!: number;

  @ApiProperty({ example: 31.2357 })
  longitude!: number;

  @ApiProperty({ example: 100 })
  radius_meters!: number;

  @ApiPropertyOptional({ example: 'c8d0e513-5b8b-4c74-8b6b-1a5ec4c74567' })
  institution_id?: string | null;

  @ApiPropertyOptional({ example: false })
  bypass_face?: boolean | null;

  @ApiPropertyOptional({ example: false })
  bypass_location?: boolean | null;

  @ApiPropertyOptional({ example: false })
  bypass_checkout_window?: boolean | null;

  @ApiPropertyOptional({ example: false })
  require_qr?: boolean | null;

  @ApiPropertyOptional({ example: true })
  qr_enabled?: boolean | null;

  @ApiPropertyOptional({ example: false })
  block_checkin?: boolean | null;
}

export class BranchOptionResponseDto {
  @ApiProperty({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  id!: string;

  @ApiProperty({ example: 'Main Branch' })
  name!: string;
}

/* --- Groups --- */

export class CreateGroupDto {
  @ApiProperty({ example: 'Interns 2026' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  year!: number;

  @ApiPropertyOptional({ example: 'c8d0e513-5b8b-4c74-8b6b-1a5ec4c74567' })
  @IsOptional()
  @IsUUID()
  institution_id?: string | null;

  @ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  @IsOptional()
  @IsUUID()
  branch_id?: string | null;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  start_date?: string | null;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  end_date?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  bypass_face?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  bypass_location?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  bypass_checkout_window?: boolean = false;
}

export class UpdateGroupDto extends CreateGroupDto {}

export class GroupResponseDto {
  @ApiProperty({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' })
  id!: string;

  @ApiProperty({ example: 'Interns 2026' })
  name!: string;

  @ApiProperty({ example: 2026 })
  year!: number;

  @ApiPropertyOptional({ example: 'c8d0e513-5b8b-4c74-8b6b-1a5ec4c74567' })
  institution_id?: string | null;

  @ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  branch_id?: string | null;

  @ApiPropertyOptional({ example: '2026-01-01' })
  start_date?: string | null;

  @ApiPropertyOptional({ example: '2026-12-31' })
  end_date?: string | null;

  @ApiPropertyOptional({ example: false })
  bypass_face?: boolean | null;

  @ApiPropertyOptional({ example: false })
  bypass_location?: boolean | null;

  @ApiPropertyOptional({ example: false })
  bypass_checkout_window?: boolean | null;
}

export class GroupOptionResponseDto {
  @ApiProperty({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' })
  id!: string;

  @ApiProperty({ example: 'Interns 2026' })
  name!: string;
}

/* --- Shifts --- */

export class CreateShiftDto {
  @ApiProperty({ example: 'Morning Shift' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'MORNING' })
  @IsOptional()
  @IsString()
  key?: string | null;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @IsString()
  checkin_open?: string | null;

  @ApiPropertyOptional({ example: '09:30' })
  @IsOptional()
  @IsString()
  checkin_late?: string | null;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @IsString()
  checkin_close?: string | null;

  @ApiPropertyOptional({ example: '16:00' })
  @IsOptional()
  @IsString()
  checkout_open?: string | null;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  checkout_close?: string | null;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @IsNotEmpty()
  start_time!: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  @IsNotEmpty()
  end_time!: string;
}

export class UpdateShiftDto extends CreateShiftDto {}

export class ShiftResponseDto {
  @ApiProperty({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74333' })
  id!: string;

  @ApiProperty({ example: 'Morning Shift' })
  name!: string;

  @ApiPropertyOptional({ example: 'MORNING' })
  key?: string | null;

  @ApiPropertyOptional({ example: '08:00' })
  checkin_open?: string | null;

  @ApiPropertyOptional({ example: '09:30' })
  checkin_late?: string | null;

  @ApiPropertyOptional({ example: '10:00' })
  checkin_close?: string | null;

  @ApiPropertyOptional({ example: '16:00' })
  checkout_open?: string | null;

  @ApiPropertyOptional({ example: '18:00' })
  checkout_close?: string | null;

  @ApiProperty({ example: '09:00' })
  start_time!: string;

  @ApiProperty({ example: '17:00' })
  end_time!: string;
}

export class ShiftKeyOptionResponseDto {
  @ApiProperty({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74333' })
  id!: string;

  @ApiPropertyOptional({ example: 'MORNING' })
  key?: string | null;
}
