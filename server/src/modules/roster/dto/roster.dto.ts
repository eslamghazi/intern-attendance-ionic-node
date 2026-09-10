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

export class BulkRosterResultDto {
  @ApiProperty({ example: 20 })
  members!: number;

  @ApiProperty({ example: 45 })
  added!: number;

  @ApiProperty({ example: 5 })
  removed!: number;
}

export class RosterMakerMemberDto {
  @ApiPropertyOptional({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  member_id!: string | null;

  @ApiPropertyOptional({ example: '2026010107' })
  code!: string | null;

  @ApiPropertyOptional({ example: 'Ahmed Mohamed' })
  full_name!: string | null;
}

export class RosterMakerShiftDto {
  @ApiProperty({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' })
  id!: string;

  @ApiPropertyOptional({ example: 'M' })
  key!: string | null;

  @ApiProperty({ example: 'Morning Shift' })
  name!: string;
}

export class RosterMakerScheduleDto {
  @ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  member_id!: string;

  @ApiProperty({ example: 10 })
  day!: number;

  @ApiPropertyOptional({ example: 'M' })
  key!: string | null;
}

export class RosterMakerDataDto {
  @ApiProperty({ type: [RosterMakerMemberDto] })
  members!: RosterMakerMemberDto[];

  @ApiProperty({ type: [RosterMakerShiftDto] })
  shifts!: RosterMakerShiftDto[];

  @ApiProperty({ type: [RosterMakerScheduleDto] })
  roster!: RosterMakerScheduleDto[];
}

export class RosterCellDto {
  @ApiProperty({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' })
  shift_id!: string;

  @ApiProperty({ example: 'M' })
  label!: string;
}

export class RosterViewRowDto {
  @ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  member_id!: string;

  @ApiProperty({ example: '29801011234567' })
  national_id!: string;

  @ApiPropertyOptional({ example: '2026010107' })
  member_code!: string | null;

  @ApiProperty({ example: 'Ahmed Mohamed' })
  full_name!: string;

  @ApiProperty({ description: 'Day map containing array of shifts', example: { '1': [{ shift_id: 's1', label: 'M' }] } })
  days!: Record<string, RosterCellDto[]>;
}

export class RosterTotalsResponseDto {
  @ApiProperty()
  perDay!: Record<number, number>;

  @ApiProperty()
  perDayShift!: Record<number, Record<string, number>>;

  @ApiProperty({ example: 42 })
  total!: number;
}

