import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_PAGE_SIZE } from '../../../domain/member/filter.js';
import { OUTCOME_LEGEND_ORDER, type AttendanceOutcomeKey } from '../../../config/constants.js';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  IsArray,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MemberFilterQueryDto } from '../../members/dto/member.dto.js';
import type { MonthStats, RateBasis, DayStat } from '../../../domain/report/rate.js';

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

/** GET /attendance/history/export — the same query, plus which file to make. */
export class GetHistoryExportQueryDto extends GetHistoryQueryDto {
  @ApiPropertyOptional({ description: 'Export format', enum: ['xlsx', 'pdf'], default: 'xlsx' })
  @IsOptional()
  @IsIn(['xlsx', 'pdf'])
  format?: 'xlsx' | 'pdf';
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
  @Max(MAX_PAGE_SIZE)
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

/** GET /attendance/dashboard/export — the stats query, plus which file to make. */
export class GetDashboardExportQueryDto extends GetStatsQueryDto {
  @ApiPropertyOptional({ description: 'Group UUID' })
  @IsUUID()
  @IsOptional()
  groupId?: string | null;

  @ApiPropertyOptional({ description: 'Shift UUID' })
  @IsUUID()
  @IsOptional()
  shiftId?: string | null;

  @ApiPropertyOptional({ description: 'Department UUID' })
  @IsUUID()
  @IsOptional()
  departmentId?: string | null;

  @ApiPropertyOptional({ description: 'Export format', enum: ['xlsx', 'pdf'], default: 'xlsx' })
  @IsOptional()
  @IsIn(['xlsx', 'pdf'])
  format?: 'xlsx' | 'pdf';
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

export class PresentMemberRowDto {
  @ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  member_id!: string;

  @ApiProperty({ example: '2026-09-10' })
  date!: string;

  @ApiPropertyOptional({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' })
  shift_id!: string | null;

  @ApiPropertyOptional({ example: 'Morning Shift' })
  shift_name!: string | null;

  @ApiProperty({ example: 'present' })
  status!: string;

  @ApiPropertyOptional({ example: 'checked_out' })
  checkout_status!: string | null;

  @ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' })
  check_in_at!: string | null;

  @ApiProperty({ example: 'Ahmed Mohamed' })
  full_name!: string;

  @ApiProperty({ example: '29801011234567' })
  national_id!: string;

  @ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  branch_id!: string | null;

  @ApiPropertyOptional({ example: 'Main Branch' })
  branch_name!: string | null;

  @ApiPropertyOptional({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' })
  group_id!: string | null;

  @ApiPropertyOptional({ example: 'Interns 2026' })
  group_name!: string | null;
}

export class ReviewMemberProfileDto {
  @ApiProperty({ example: 'Ahmed Mohamed' })
  full_name!: string;

  @ApiProperty({ example: '29801011234567' })
  national_id!: string;
}

export class ReviewMemberDto {
  @ApiProperty({ type: ReviewMemberProfileDto })
  profile!: ReviewMemberProfileDto | null;
}

export class ReviewAttendanceItemDto {
  @ApiProperty({ example: 'a1d0e513-5b8b-4c74-8b6b-1a5ec4c74001' })
  id!: string;

  @ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  memberId!: string;

  @ApiProperty({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  branchId!: string;

  @ApiProperty({ example: '2026-09-10' })
  date!: string;

  @ApiProperty({ example: 'present' })
  status!: string;

  @ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' })
  checkInAt!: string | null;

  @ApiPropertyOptional({ example: 'checked_out' })
  checkoutStatus!: string | null;

  @ApiProperty({ type: ReviewMemberDto })
  member!: ReviewMemberDto;
}

export class DetailAttendanceItemDto extends ReviewAttendanceItemDto {}

export class AttendanceHistoryEntryDto {
  @ApiProperty({ example: 'a1d0e513-5b8b-4c74-8b6b-1a5ec4c74001' })
  id!: string;

  @ApiProperty({ example: '2026-09-10' })
  date!: string;

  @ApiPropertyOptional({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' })
  shift_id!: string | null;

  @ApiPropertyOptional({ example: 'Morning Shift' })
  shift_name!: string | null;

  @ApiProperty({ example: 'present' })
  status!: string;

  @ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' })
  check_in_at!: string | null;

  @ApiPropertyOptional({ example: '2026-09-10T16:00:00.000Z' })
  check_out_at!: string | null;

  @ApiPropertyOptional({ example: 'checked_out' })
  checkout_status!: string | null;

  /**
   * Arrival and departure as ONE value — see domain/attendance/outcome.ts.
   *
   * Computed by the server and read by the screen and by the export, so both
   * describe a day the same way. It was returned but not declared here, so the
   * DTO the route advertised was missing the field the client actually renders.
   */
  @ApiProperty({ enum: OUTCOME_LEGEND_ORDER, example: 'present_out' })
  outcome!: AttendanceOutcomeKey;
}

/**
 * A shift, with the five boundaries the day screen draws its timeline from.
 *
 * Each may be null: a shift that leaves them unset inherits the defaults in
 * config/constants.ts, and the client applies the same rule the recorder does.
 */
export class DayShiftDto {
  @ApiProperty({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' })
  id!: string;

  @ApiProperty({ example: 'Morning Shift' })
  name!: string;

  @ApiPropertyOptional({ example: 'morning', description: 'Null on a shift created without one' })
  key!: string | null;

  @ApiProperty({ example: '08:00' })
  start_time!: string;

  @ApiProperty({ example: '16:00' })
  end_time!: string;

  @ApiPropertyOptional({ example: '07:30' })
  checkin_open!: string | null;

  @ApiPropertyOptional({ example: '08:15' })
  checkin_late!: string | null;

  @ApiPropertyOptional({ example: '09:00' })
  checkin_close!: string | null;

  @ApiPropertyOptional({ example: '16:00' })
  checkout_open!: string | null;

  @ApiPropertyOptional({ example: '19:00' })
  checkout_close!: string | null;
}

export class DayAttendanceItemDto {
  @ApiProperty({ example: 'a1d0e513-5b8b-4c74-8b6b-1a5ec4c74001' })
  id!: string;

  @ApiProperty({ example: '2026-09-10' })
  date!: string;

  @ApiPropertyOptional({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' })
  shift_id!: string | null;

  @ApiPropertyOptional({ example: 'Morning Shift' })
  shift_name!: string | null;

  @ApiProperty({ example: 'present' })
  status!: string;

  @ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' })
  check_in_at!: string | null;

  @ApiPropertyOptional({ example: '2026-09-10T16:00:00.000Z' })
  check_out_at!: string | null;

  @ApiPropertyOptional({ type: DayShiftDto, description: 'Null when the shift was deleted after the fact' })
  shift!: DayShiftDto | null;
}

/**
 * One member, one day: what they were rostered for and what actually happened.
 *
 * The two lists are separate on purpose and neither implies the other — a day
 * with a roster and no attendance is an absence, and attendance with no roster
 * is someone who turned up when they were not expected. The screen shows both.
 */
export class DayAttendanceResultDto {
  @ApiProperty({ type: [DayShiftDto], description: 'What the member was rostered for' })
  shifts!: DayShiftDto[];

  @ApiProperty({ type: [DayAttendanceItemDto], description: 'What was actually recorded' })
  attendance!: DayAttendanceItemDto[];
}

export class ReportMemberProfileDto {
  @ApiProperty({ example: 'Ahmed Mohamed' })
  full_name!: string;

  @ApiProperty({ example: '29801011234567' })
  national_id!: string;
}

export class ReportMemberDto {
  @ApiPropertyOptional({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' })
  group_id!: string | null;

  @ApiProperty({ type: ReportMemberProfileDto })
  profile!: ReportMemberProfileDto;

  @ApiPropertyOptional({ example: { name: 'Batch 2026' } })
  group!: { name: string } | null;

  @ApiPropertyOptional({ example: { name: 'Kasr Al Ainy' } })
  branch!: { name: string } | null;
}

/** One attendance row in a date-range report, with the member spelled out. */
export class ReportRowDto {
  @ApiProperty({ example: '2026-09-10' })
  date!: string;

  @ApiProperty({ example: 'present' })
  status!: string;

  @ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' })
  check_in_at!: string | null;

  @ApiPropertyOptional({ example: '2026-09-10T16:00:00.000Z' })
  check_out_at!: string | null;

  @ApiProperty({ type: ReportMemberDto })
  member!: ReportMemberDto;
}

export class DailyRosterShiftLiteDto {
  @ApiProperty({ example: 'Morning Shift' })
  name!: string;

  @ApiPropertyOptional({ example: 'M' })
  key!: string | null;

  @ApiProperty({ example: '08:00' })
  start_time!: string;

  @ApiProperty({ example: '16:00' })
  end_time!: string;
}

export class DailyRosterItemDto {
  @ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  member_id!: string;

  @ApiProperty({ example: 'Ahmed Mohamed' })
  full_name!: string;

  @ApiProperty({ example: '29801011234567' })
  national_id!: string;

  @ApiPropertyOptional({ type: DailyRosterShiftLiteDto })
  shift!: DailyRosterShiftLiteDto | null;

  @ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' })
  check_in_at!: string | null;

  @ApiPropertyOptional({ example: '2026-09-10T16:00:00.000Z' })
  check_out_at!: string | null;

  @ApiProperty({ example: 'present' })
  status!: string;
}

export class MonthlyAttendanceRowDto {
  @ApiPropertyOptional({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  member_id!: string | null;

  @ApiPropertyOptional({ example: 'Ahmed Mohamed' })
  full_name!: string | null;

  @ApiPropertyOptional({ example: '29801011234567' })
  national_id!: string | null;

  @ApiProperty({ description: 'Day map containing array of status strings' })
  days!: Record<string, string[]>;

  @ApiProperty({ description: 'Day map containing array of checkout statuses' })
  checkouts!: Record<string, (string | null)[]>;
}

export class TodaySummaryMemberDto {
  @ApiProperty({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' })
  group_id!: string;
}

export class TodaySummaryDto {
  @ApiProperty({ example: 'present' })
  status!: 'present' | 'late' | 'early_leave' | 'absent' | 'left_work';

  @ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' })
  check_in_at!: string | null;

  @ApiProperty({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  branch_id!: string;

  @ApiProperty({ type: TodaySummaryMemberDto })
  member!: TodaySummaryMemberDto;
}

export class StatsSummaryDto implements MonthStats {
  @ApiProperty({ example: 100 })
  attended!: number;

  @ApiProperty({ example: 10 })
  late!: number;

  @ApiProperty({ example: 5 })
  absent!: number;

  @ApiProperty({ example: 2 })
  pending!: number;

  @ApiProperty({ example: 10 })
  attendedOpen!: number;

  @ApiProperty({ example: 90 })
  attendedSettled!: number;

  @ApiProperty({ example: 90 })
  present!: number;

  @ApiProperty({ example: 95 })
  settled!: number;

  @ApiProperty({ example: 'settled' })
  rateBasis!: RateBasis;

  @ApiProperty({ example: 94.7 })
  rate!: number;

  @ApiProperty()
  perBranch!: { branch_id: string; value: number }[];

  @ApiProperty()
  perGroup!: { group_id: string; value: number }[];

  @ApiProperty()
  perShift!: { shift_id: string; value: number }[];

  @ApiProperty()
  perBranchStatus!: { branch_id: string; present: number; late: number; absent: number }[];

  @ApiProperty()
  perDay!: DayStat[];
}

export class ProbeItemDto {
  @ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  member_id!: string;

  @ApiProperty({ example: '2026-09-10' })
  date!: string;

  @ApiPropertyOptional({ example: 'Morning Shift' })
  shift_name!: string | null;

  @ApiProperty({ example: 'check_in' })
  type!: string;

  @ApiPropertyOptional({ example: 'group/2026_01/probe.jpg' })
  path!: string | null;

  @ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' })
  at!: string | null;

  @ApiPropertyOptional({ example: 0.95 })
  face_score!: number | null;
}



