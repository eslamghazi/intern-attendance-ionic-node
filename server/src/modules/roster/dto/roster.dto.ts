import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MemberFilterQueryDto } from '../../members/dto/member.dto.js';

export class MonthQueryDto {
  @ApiProperty({ description: 'Year', example: 2026 })
  @Type(() => Number)
  @IsInt()
  year!: number;

  @ApiProperty({ description: 'Month (1-12)', example: 9 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

export class RosterDayInputDto {
  @ApiProperty({ description: 'Member UUID' })
  @IsUUID()
  @IsNotEmpty()
  member_id!: string;

  @ApiProperty({ description: 'Target date (YYYY-MM-DD)', example: '2026-09-10' })
  @IsString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({ description: 'Assigned shift UUID' })
  @IsUUID()
  @IsNotEmpty()
  shift_id!: string;
}

export class GetRosterViewQueryDto extends MemberFilterQueryDto {
  @ApiProperty({ description: 'Year', example: 2026 })
  @Type(() => Number)
  @IsInt()
  override year: number = 0;

  @ApiProperty({ description: 'Month (1-12)', example: 9 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  override month: number = 0;




  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  override page: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  override page_size: number = 50;
}

export class GetExistingKeysDto {
  @ApiProperty({ description: 'Year', example: 2026 })
  @Type(() => Number)
  @IsInt()
  year!: number;

  @ApiProperty({ description: 'Month (1-12)', example: 9 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({ description: 'List of member UUIDs', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  member_ids!: string[];
}

export class PostRosterDaysDto {
  @ApiPropertyOptional({ type: [RosterDayInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RosterDayInputDto)
  @IsOptional()
  days?: RosterDayInputDto[];

  @ApiPropertyOptional({ description: 'Member UUID (if single day)' })
  @IsUUID()
  @IsOptional()
  member_id?: string;

  @ApiPropertyOptional({ description: 'Date (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ description: 'Shift UUID' })
  @IsUUID()
  @IsOptional()
  shift_id?: string;
}

export class BulkRosterDto extends MemberFilterQueryDto {
  @ApiProperty({ description: 'Year', example: 2026 })
  @Type(() => Number)
  @IsInt()
  override year: number = 0;

  @ApiProperty({ description: 'Month (1-12)', example: 9 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  override month: number = 0;




  @ApiProperty({ description: 'Shift UUID' })
  @IsUUID()
  @IsNotEmpty()
  shift_id!: string;

  @ApiProperty({ description: 'Start day of the month', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  from_day!: number;

  @ApiProperty({ description: 'End day of the month', example: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  to_day!: number;

  @ApiProperty({ description: 'Operation mode', enum: ['add', 'remove', 'replace'] })
  @IsIn(['add', 'remove', 'replace'])
  mode!: 'add' | 'remove' | 'replace';
}
