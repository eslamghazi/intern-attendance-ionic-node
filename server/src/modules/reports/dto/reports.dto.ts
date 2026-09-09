import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MemberFilterQueryDto } from '../../members/dto/member.dto.js';

export class GetPresentQueryDto {
  @ApiProperty({ description: 'Comma-separated dates (YYYY-MM-DD)', example: '2026-09-09,2026-09-10' })
  @IsString()
  @IsNotEmpty()
  dates!: string;
}

export class GetReviewQueryDto {
  @ApiProperty({ description: 'Date (YYYY-MM-DD)', example: '2026-09-10' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiPropertyOptional({ description: 'Branch UUID' })
  @IsUUID()
  @IsOptional()
  branch_id?: string | null;
}

export class GetDetailQueryDto {
  @ApiProperty({ description: 'Member UUID' })
  @IsUUID()
  @IsNotEmpty()
  member_id!: string;

  @ApiProperty({ description: 'Date (YYYY-MM-DD)', example: '2026-09-10' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiPropertyOptional({ description: 'Shift UUID' })
  @IsUUID()
  @IsOptional()
  shift_id?: string | null;
}

export class GetHistoryQueryDto {
  @ApiProperty({ description: 'Member UUID' })
  @IsUUID()
  @IsNotEmpty()
  member_id!: string;

  @ApiPropertyOptional({ description: 'Year', example: 2026 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  year?: number;

  @ApiPropertyOptional({ description: 'Month (1-12)', example: 9 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  month?: number;
}

export class GetDayQueryDto {
  @ApiProperty({ description: 'Member UUID' })
  @IsUUID()
  @IsNotEmpty()
  member_id!: string;

  @ApiProperty({ description: 'Date (YYYY-MM-DD)', example: '2026-09-10' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
}

export class GetDailyRosterQueryDto {
  @ApiProperty({ description: 'Date (YYYY-MM-DD)', example: '2026-09-10' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiPropertyOptional({ description: 'Branch UUID' })
  @IsUUID()
  @IsOptional()
  branch_id?: string | null;
}

export class GetMonthlyQueryDto extends MemberFilterQueryDto {
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

export class GetReportQueryDto {
  @ApiProperty({ description: 'Start date (YYYY-MM-DD)', example: '2026-09-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @ApiProperty({ description: 'End date (YYYY-MM-DD)', example: '2026-09-30' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;

  @ApiPropertyOptional({ description: 'Branch UUID' })
  @IsUUID()
  @IsOptional()
  branch_id?: string | null;

  @ApiPropertyOptional({ description: 'Group UUID' })
  @IsUUID()
  @IsOptional()
  group_id?: string | null;
}

export class GetTodayQueryDto {
  @ApiProperty({ description: 'Date (YYYY-MM-DD)', example: '2026-09-10' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
}

export class GetStatsQueryDto {
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

  @ApiPropertyOptional({ description: 'Day (1-31)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  day?: number | null;

  @ApiPropertyOptional({ description: 'Branch UUID' })
  @IsUUID()
  @IsOptional()
  branchId?: string | null;
}

export class GetProbesDto {
  @ApiProperty({ description: 'Array of member UUIDs', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  member_ids!: string[];

  @ApiProperty({ description: 'From date (YYYY-MM-DD)', example: '2026-09-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @ApiProperty({ description: 'To date (YYYY-MM-DD)', example: '2026-09-30' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;
}

