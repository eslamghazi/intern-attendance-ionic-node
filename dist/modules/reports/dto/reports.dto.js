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
import { MAX_PAGE_SIZE } from '../../../domain/member/filter.js';
import { OUTCOME_LEGEND_ORDER } from '../../../config/constants.js';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsIn, IsInt, Min, Max, IsArray, Matches, } from 'class-validator';
import { Type } from 'class-transformer';
import { MemberFilterQueryDto } from '../../members/dto/member.dto.js';
export class GetPresentQueryDto {
    dates;
}
__decorate([
    ApiProperty({ description: 'Comma-separated dates (YYYY-MM-DD)', example: '2026-09-09,2026-09-10' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], GetPresentQueryDto.prototype, "dates", void 0);
export class GetReviewQueryDto {
    date;
    branch_id;
}
__decorate([
    ApiProperty({ description: 'Date (YYYY-MM-DD)', example: '2026-09-10' }),
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], GetReviewQueryDto.prototype, "date", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Branch UUID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], GetReviewQueryDto.prototype, "branch_id", void 0);
export class GetDetailQueryDto {
    member_id;
    date;
    shift_id;
}
__decorate([
    ApiProperty({ description: 'Member UUID' }),
    IsUUID(),
    IsNotEmpty(),
    __metadata("design:type", String)
], GetDetailQueryDto.prototype, "member_id", void 0);
__decorate([
    ApiProperty({ description: 'Date (YYYY-MM-DD)', example: '2026-09-10' }),
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], GetDetailQueryDto.prototype, "date", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Shift UUID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], GetDetailQueryDto.prototype, "shift_id", void 0);
export class GetHistoryQueryDto {
    member_id;
    year;
    month;
}
__decorate([
    ApiProperty({ description: 'Member UUID' }),
    IsUUID(),
    IsNotEmpty(),
    __metadata("design:type", String)
], GetHistoryQueryDto.prototype, "member_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Year', example: 2026 }),
    Type(() => Number),
    IsInt(),
    IsOptional(),
    __metadata("design:type", Number)
], GetHistoryQueryDto.prototype, "year", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Month (1-12)', example: 9 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(12),
    IsOptional(),
    __metadata("design:type", Number)
], GetHistoryQueryDto.prototype, "month", void 0);
/** GET /attendance/history/export — the same query, plus which file to make. */
export class GetHistoryExportQueryDto extends GetHistoryQueryDto {
    format;
}
__decorate([
    ApiPropertyOptional({ description: 'Export format', enum: ['xlsx', 'pdf'], default: 'xlsx' }),
    IsOptional(),
    IsIn(['xlsx', 'pdf']),
    __metadata("design:type", String)
], GetHistoryExportQueryDto.prototype, "format", void 0);
export class GetDayQueryDto {
    member_id;
    date;
}
__decorate([
    ApiProperty({ description: 'Member UUID' }),
    IsUUID(),
    IsNotEmpty(),
    __metadata("design:type", String)
], GetDayQueryDto.prototype, "member_id", void 0);
__decorate([
    ApiProperty({ description: 'Date (YYYY-MM-DD)', example: '2026-09-10' }),
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], GetDayQueryDto.prototype, "date", void 0);
export class GetDailyRosterQueryDto {
    date;
    branch_id;
}
__decorate([
    ApiProperty({ description: 'Date (YYYY-MM-DD)', example: '2026-09-10' }),
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], GetDailyRosterQueryDto.prototype, "date", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Branch UUID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], GetDailyRosterQueryDto.prototype, "branch_id", void 0);
export class GetMonthlyQueryDto extends MemberFilterQueryDto {
    year = 0;
    month = 0;
    page = 1;
    page_size = 50;
}
__decorate([
    ApiProperty({ description: 'Year', example: 2026 }),
    Type(() => Number),
    IsInt(),
    __metadata("design:type", Number)
], GetMonthlyQueryDto.prototype, "year", void 0);
__decorate([
    ApiProperty({ description: 'Month (1-12)', example: 9 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(12),
    __metadata("design:type", Number)
], GetMonthlyQueryDto.prototype, "month", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Page number', default: 1 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    IsOptional(),
    __metadata("design:type", Number)
], GetMonthlyQueryDto.prototype, "page", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Page size', default: 50 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(MAX_PAGE_SIZE),
    IsOptional(),
    __metadata("design:type", Number)
], GetMonthlyQueryDto.prototype, "page_size", void 0);
export class GetReportQueryDto {
    from;
    to;
    branch_id;
    group_id;
}
__decorate([
    ApiProperty({ description: 'Start date (YYYY-MM-DD)', example: '2026-09-01' }),
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], GetReportQueryDto.prototype, "from", void 0);
__decorate([
    ApiProperty({ description: 'End date (YYYY-MM-DD)', example: '2026-09-30' }),
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], GetReportQueryDto.prototype, "to", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Branch UUID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], GetReportQueryDto.prototype, "branch_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Group UUID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], GetReportQueryDto.prototype, "group_id", void 0);
export class GetTodayQueryDto {
    date;
}
__decorate([
    ApiProperty({ description: 'Date (YYYY-MM-DD)', example: '2026-09-10' }),
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], GetTodayQueryDto.prototype, "date", void 0);
export class GetStatsQueryDto {
    year;
    month;
    day;
    branchId;
}
__decorate([
    ApiProperty({ description: 'Year', example: 2026 }),
    Type(() => Number),
    IsInt(),
    __metadata("design:type", Number)
], GetStatsQueryDto.prototype, "year", void 0);
__decorate([
    ApiProperty({ description: 'Month (1-12)', example: 9 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(12),
    __metadata("design:type", Number)
], GetStatsQueryDto.prototype, "month", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Day (1-31)' }),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(31),
    IsOptional(),
    __metadata("design:type", Object)
], GetStatsQueryDto.prototype, "day", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Branch UUID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], GetStatsQueryDto.prototype, "branchId", void 0);
/** GET /attendance/dashboard/export — the stats query, plus which file to make. */
export class GetDashboardExportQueryDto extends GetStatsQueryDto {
    groupId;
    shiftId;
    departmentId;
    format;
}
__decorate([
    ApiPropertyOptional({ description: 'Group UUID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], GetDashboardExportQueryDto.prototype, "groupId", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Shift UUID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], GetDashboardExportQueryDto.prototype, "shiftId", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Department UUID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], GetDashboardExportQueryDto.prototype, "departmentId", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Export format', enum: ['xlsx', 'pdf'], default: 'xlsx' }),
    IsOptional(),
    IsIn(['xlsx', 'pdf']),
    __metadata("design:type", String)
], GetDashboardExportQueryDto.prototype, "format", void 0);
export class GetProbesDto {
    member_ids;
    from;
    to;
}
__decorate([
    ApiProperty({ description: 'Array of member UUIDs', type: [String] }),
    IsArray(),
    IsUUID('4', { each: true }),
    __metadata("design:type", Array)
], GetProbesDto.prototype, "member_ids", void 0);
__decorate([
    ApiProperty({ description: 'From date (YYYY-MM-DD)', example: '2026-09-01' }),
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], GetProbesDto.prototype, "from", void 0);
__decorate([
    ApiProperty({ description: 'To date (YYYY-MM-DD)', example: '2026-09-30' }),
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], GetProbesDto.prototype, "to", void 0);
export class PresentMemberRowDto {
    member_id;
    date;
    shift_id;
    shift_name;
    status;
    checkout_status;
    check_in_at;
    full_name;
    national_id;
    branch_id;
    branch_name;
    group_id;
    group_name;
}
__decorate([
    ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], PresentMemberRowDto.prototype, "member_id", void 0);
__decorate([
    ApiProperty({ example: '2026-09-10' }),
    __metadata("design:type", String)
], PresentMemberRowDto.prototype, "date", void 0);
__decorate([
    ApiPropertyOptional({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' }),
    __metadata("design:type", Object)
], PresentMemberRowDto.prototype, "shift_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'Morning Shift' }),
    __metadata("design:type", Object)
], PresentMemberRowDto.prototype, "shift_name", void 0);
__decorate([
    ApiProperty({ example: 'present' }),
    __metadata("design:type", String)
], PresentMemberRowDto.prototype, "status", void 0);
__decorate([
    ApiPropertyOptional({ example: 'checked_out' }),
    __metadata("design:type", Object)
], PresentMemberRowDto.prototype, "checkout_status", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' }),
    __metadata("design:type", Object)
], PresentMemberRowDto.prototype, "check_in_at", void 0);
__decorate([
    ApiProperty({ example: 'Ahmed Mohamed' }),
    __metadata("design:type", String)
], PresentMemberRowDto.prototype, "full_name", void 0);
__decorate([
    ApiProperty({ example: '29801011234567' }),
    __metadata("design:type", String)
], PresentMemberRowDto.prototype, "national_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    __metadata("design:type", Object)
], PresentMemberRowDto.prototype, "branch_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'Main Branch' }),
    __metadata("design:type", Object)
], PresentMemberRowDto.prototype, "branch_name", void 0);
__decorate([
    ApiPropertyOptional({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' }),
    __metadata("design:type", Object)
], PresentMemberRowDto.prototype, "group_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'Interns 2026' }),
    __metadata("design:type", Object)
], PresentMemberRowDto.prototype, "group_name", void 0);
export class ReviewMemberProfileDto {
    full_name;
    national_id;
}
__decorate([
    ApiProperty({ example: 'Ahmed Mohamed' }),
    __metadata("design:type", String)
], ReviewMemberProfileDto.prototype, "full_name", void 0);
__decorate([
    ApiProperty({ example: '29801011234567' }),
    __metadata("design:type", String)
], ReviewMemberProfileDto.prototype, "national_id", void 0);
export class ReviewMemberDto {
    profile;
}
__decorate([
    ApiProperty({ type: ReviewMemberProfileDto }),
    __metadata("design:type", Object)
], ReviewMemberDto.prototype, "profile", void 0);
export class ReviewAttendanceItemDto {
    id;
    memberId;
    branchId;
    date;
    status;
    checkInAt;
    checkoutStatus;
    member;
}
__decorate([
    ApiProperty({ example: 'a1d0e513-5b8b-4c74-8b6b-1a5ec4c74001' }),
    __metadata("design:type", String)
], ReviewAttendanceItemDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], ReviewAttendanceItemDto.prototype, "memberId", void 0);
__decorate([
    ApiProperty({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    __metadata("design:type", String)
], ReviewAttendanceItemDto.prototype, "branchId", void 0);
__decorate([
    ApiProperty({ example: '2026-09-10' }),
    __metadata("design:type", String)
], ReviewAttendanceItemDto.prototype, "date", void 0);
__decorate([
    ApiProperty({ example: 'present' }),
    __metadata("design:type", String)
], ReviewAttendanceItemDto.prototype, "status", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' }),
    __metadata("design:type", Object)
], ReviewAttendanceItemDto.prototype, "checkInAt", void 0);
__decorate([
    ApiPropertyOptional({ example: 'checked_out' }),
    __metadata("design:type", Object)
], ReviewAttendanceItemDto.prototype, "checkoutStatus", void 0);
__decorate([
    ApiProperty({ type: ReviewMemberDto }),
    __metadata("design:type", ReviewMemberDto)
], ReviewAttendanceItemDto.prototype, "member", void 0);
export class DetailAttendanceItemDto extends ReviewAttendanceItemDto {
}
export class AttendanceHistoryEntryDto {
    id;
    date;
    shift_id;
    shift_name;
    status;
    check_in_at;
    check_out_at;
    checkout_status;
    /**
     * Arrival and departure as ONE value — see domain/attendance/outcome.ts.
     *
     * Computed by the server and read by the screen and by the export, so both
     * describe a day the same way. It was returned but not declared here, so the
     * DTO the route advertised was missing the field the client actually renders.
     */
    outcome;
}
__decorate([
    ApiProperty({ example: 'a1d0e513-5b8b-4c74-8b6b-1a5ec4c74001' }),
    __metadata("design:type", String)
], AttendanceHistoryEntryDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: '2026-09-10' }),
    __metadata("design:type", String)
], AttendanceHistoryEntryDto.prototype, "date", void 0);
__decorate([
    ApiPropertyOptional({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' }),
    __metadata("design:type", Object)
], AttendanceHistoryEntryDto.prototype, "shift_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'Morning Shift' }),
    __metadata("design:type", Object)
], AttendanceHistoryEntryDto.prototype, "shift_name", void 0);
__decorate([
    ApiProperty({ example: 'present' }),
    __metadata("design:type", String)
], AttendanceHistoryEntryDto.prototype, "status", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' }),
    __metadata("design:type", Object)
], AttendanceHistoryEntryDto.prototype, "check_in_at", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10T16:00:00.000Z' }),
    __metadata("design:type", Object)
], AttendanceHistoryEntryDto.prototype, "check_out_at", void 0);
__decorate([
    ApiPropertyOptional({ example: 'checked_out' }),
    __metadata("design:type", Object)
], AttendanceHistoryEntryDto.prototype, "checkout_status", void 0);
__decorate([
    ApiProperty({ enum: OUTCOME_LEGEND_ORDER, example: 'present_out' }),
    __metadata("design:type", String)
], AttendanceHistoryEntryDto.prototype, "outcome", void 0);
/**
 * A shift, with the five boundaries the day screen draws its timeline from.
 *
 * Each may be null: a shift that leaves them unset inherits the defaults in
 * config/constants.ts, and the client applies the same rule the recorder does.
 */
export class DayShiftDto {
    id;
    name;
    key;
    start_time;
    end_time;
    checkin_open;
    checkin_late;
    checkin_close;
    checkout_open;
    checkout_close;
}
__decorate([
    ApiProperty({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' }),
    __metadata("design:type", String)
], DayShiftDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'Morning Shift' }),
    __metadata("design:type", String)
], DayShiftDto.prototype, "name", void 0);
__decorate([
    ApiPropertyOptional({ example: 'morning', description: 'Null on a shift created without one' }),
    __metadata("design:type", Object)
], DayShiftDto.prototype, "key", void 0);
__decorate([
    ApiProperty({ example: '08:00' }),
    __metadata("design:type", String)
], DayShiftDto.prototype, "start_time", void 0);
__decorate([
    ApiProperty({ example: '16:00' }),
    __metadata("design:type", String)
], DayShiftDto.prototype, "end_time", void 0);
__decorate([
    ApiPropertyOptional({ example: '07:30' }),
    __metadata("design:type", Object)
], DayShiftDto.prototype, "checkin_open", void 0);
__decorate([
    ApiPropertyOptional({ example: '08:15' }),
    __metadata("design:type", Object)
], DayShiftDto.prototype, "checkin_late", void 0);
__decorate([
    ApiPropertyOptional({ example: '09:00' }),
    __metadata("design:type", Object)
], DayShiftDto.prototype, "checkin_close", void 0);
__decorate([
    ApiPropertyOptional({ example: '16:00' }),
    __metadata("design:type", Object)
], DayShiftDto.prototype, "checkout_open", void 0);
__decorate([
    ApiPropertyOptional({ example: '19:00' }),
    __metadata("design:type", Object)
], DayShiftDto.prototype, "checkout_close", void 0);
export class DayAttendanceItemDto {
    id;
    date;
    shift_id;
    shift_name;
    status;
    check_in_at;
    check_out_at;
    shift;
}
__decorate([
    ApiProperty({ example: 'a1d0e513-5b8b-4c74-8b6b-1a5ec4c74001' }),
    __metadata("design:type", String)
], DayAttendanceItemDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: '2026-09-10' }),
    __metadata("design:type", String)
], DayAttendanceItemDto.prototype, "date", void 0);
__decorate([
    ApiPropertyOptional({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' }),
    __metadata("design:type", Object)
], DayAttendanceItemDto.prototype, "shift_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'Morning Shift' }),
    __metadata("design:type", Object)
], DayAttendanceItemDto.prototype, "shift_name", void 0);
__decorate([
    ApiProperty({ example: 'present' }),
    __metadata("design:type", String)
], DayAttendanceItemDto.prototype, "status", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' }),
    __metadata("design:type", Object)
], DayAttendanceItemDto.prototype, "check_in_at", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10T16:00:00.000Z' }),
    __metadata("design:type", Object)
], DayAttendanceItemDto.prototype, "check_out_at", void 0);
__decorate([
    ApiPropertyOptional({ type: DayShiftDto, description: 'Null when the shift was deleted after the fact' }),
    __metadata("design:type", Object)
], DayAttendanceItemDto.prototype, "shift", void 0);
/**
 * One member, one day: what they were rostered for and what actually happened.
 *
 * The two lists are separate on purpose and neither implies the other — a day
 * with a roster and no attendance is an absence, and attendance with no roster
 * is someone who turned up when they were not expected. The screen shows both.
 */
export class DayAttendanceResultDto {
    shifts;
    attendance;
}
__decorate([
    ApiProperty({ type: [DayShiftDto], description: 'What the member was rostered for' }),
    __metadata("design:type", Array)
], DayAttendanceResultDto.prototype, "shifts", void 0);
__decorate([
    ApiProperty({ type: [DayAttendanceItemDto], description: 'What was actually recorded' }),
    __metadata("design:type", Array)
], DayAttendanceResultDto.prototype, "attendance", void 0);
export class ReportMemberProfileDto {
    full_name;
    national_id;
}
__decorate([
    ApiProperty({ example: 'Ahmed Mohamed' }),
    __metadata("design:type", String)
], ReportMemberProfileDto.prototype, "full_name", void 0);
__decorate([
    ApiProperty({ example: '29801011234567' }),
    __metadata("design:type", String)
], ReportMemberProfileDto.prototype, "national_id", void 0);
export class ReportMemberDto {
    group_id;
    profile;
    group;
    branch;
}
__decorate([
    ApiPropertyOptional({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' }),
    __metadata("design:type", Object)
], ReportMemberDto.prototype, "group_id", void 0);
__decorate([
    ApiProperty({ type: ReportMemberProfileDto }),
    __metadata("design:type", ReportMemberProfileDto)
], ReportMemberDto.prototype, "profile", void 0);
__decorate([
    ApiPropertyOptional({ example: { name: 'Batch 2026' } }),
    __metadata("design:type", Object)
], ReportMemberDto.prototype, "group", void 0);
__decorate([
    ApiPropertyOptional({ example: { name: 'Kasr Al Ainy' } }),
    __metadata("design:type", Object)
], ReportMemberDto.prototype, "branch", void 0);
/** One attendance row in a date-range report, with the member spelled out. */
export class ReportRowDto {
    date;
    status;
    check_in_at;
    check_out_at;
    member;
}
__decorate([
    ApiProperty({ example: '2026-09-10' }),
    __metadata("design:type", String)
], ReportRowDto.prototype, "date", void 0);
__decorate([
    ApiProperty({ example: 'present' }),
    __metadata("design:type", String)
], ReportRowDto.prototype, "status", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' }),
    __metadata("design:type", Object)
], ReportRowDto.prototype, "check_in_at", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10T16:00:00.000Z' }),
    __metadata("design:type", Object)
], ReportRowDto.prototype, "check_out_at", void 0);
__decorate([
    ApiProperty({ type: ReportMemberDto }),
    __metadata("design:type", ReportMemberDto)
], ReportRowDto.prototype, "member", void 0);
export class DailyRosterShiftLiteDto {
    name;
    key;
    start_time;
    end_time;
}
__decorate([
    ApiProperty({ example: 'Morning Shift' }),
    __metadata("design:type", String)
], DailyRosterShiftLiteDto.prototype, "name", void 0);
__decorate([
    ApiPropertyOptional({ example: 'M' }),
    __metadata("design:type", Object)
], DailyRosterShiftLiteDto.prototype, "key", void 0);
__decorate([
    ApiProperty({ example: '08:00' }),
    __metadata("design:type", String)
], DailyRosterShiftLiteDto.prototype, "start_time", void 0);
__decorate([
    ApiProperty({ example: '16:00' }),
    __metadata("design:type", String)
], DailyRosterShiftLiteDto.prototype, "end_time", void 0);
export class DailyRosterItemDto {
    member_id;
    full_name;
    national_id;
    shift;
    check_in_at;
    check_out_at;
    status;
}
__decorate([
    ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], DailyRosterItemDto.prototype, "member_id", void 0);
__decorate([
    ApiProperty({ example: 'Ahmed Mohamed' }),
    __metadata("design:type", String)
], DailyRosterItemDto.prototype, "full_name", void 0);
__decorate([
    ApiProperty({ example: '29801011234567' }),
    __metadata("design:type", String)
], DailyRosterItemDto.prototype, "national_id", void 0);
__decorate([
    ApiPropertyOptional({ type: DailyRosterShiftLiteDto }),
    __metadata("design:type", Object)
], DailyRosterItemDto.prototype, "shift", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' }),
    __metadata("design:type", Object)
], DailyRosterItemDto.prototype, "check_in_at", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10T16:00:00.000Z' }),
    __metadata("design:type", Object)
], DailyRosterItemDto.prototype, "check_out_at", void 0);
__decorate([
    ApiProperty({ example: 'present' }),
    __metadata("design:type", String)
], DailyRosterItemDto.prototype, "status", void 0);
export class MonthlyAttendanceRowDto {
    member_id;
    full_name;
    national_id;
    days;
    checkouts;
}
__decorate([
    ApiPropertyOptional({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", Object)
], MonthlyAttendanceRowDto.prototype, "member_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'Ahmed Mohamed' }),
    __metadata("design:type", Object)
], MonthlyAttendanceRowDto.prototype, "full_name", void 0);
__decorate([
    ApiPropertyOptional({ example: '29801011234567' }),
    __metadata("design:type", Object)
], MonthlyAttendanceRowDto.prototype, "national_id", void 0);
__decorate([
    ApiProperty({ description: 'Day map containing array of status strings' }),
    __metadata("design:type", Object)
], MonthlyAttendanceRowDto.prototype, "days", void 0);
__decorate([
    ApiProperty({ description: 'Day map containing array of checkout statuses' }),
    __metadata("design:type", Object)
], MonthlyAttendanceRowDto.prototype, "checkouts", void 0);
export class TodaySummaryMemberDto {
    group_id;
}
__decorate([
    ApiProperty({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' }),
    __metadata("design:type", String)
], TodaySummaryMemberDto.prototype, "group_id", void 0);
export class TodaySummaryDto {
    status;
    check_in_at;
    branch_id;
    member;
}
__decorate([
    ApiProperty({ example: 'present' }),
    __metadata("design:type", String)
], TodaySummaryDto.prototype, "status", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' }),
    __metadata("design:type", Object)
], TodaySummaryDto.prototype, "check_in_at", void 0);
__decorate([
    ApiProperty({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    __metadata("design:type", String)
], TodaySummaryDto.prototype, "branch_id", void 0);
__decorate([
    ApiProperty({ type: TodaySummaryMemberDto }),
    __metadata("design:type", TodaySummaryMemberDto)
], TodaySummaryDto.prototype, "member", void 0);
export class StatsSummaryDto {
    attended;
    late;
    absent;
    pending;
    attendedOpen;
    attendedSettled;
    present;
    settled;
    rateBasis;
    rate;
    perBranch;
    perGroup;
    perShift;
    perBranchStatus;
    perDay;
}
__decorate([
    ApiProperty({ example: 100 }),
    __metadata("design:type", Number)
], StatsSummaryDto.prototype, "attended", void 0);
__decorate([
    ApiProperty({ example: 10 }),
    __metadata("design:type", Number)
], StatsSummaryDto.prototype, "late", void 0);
__decorate([
    ApiProperty({ example: 5 }),
    __metadata("design:type", Number)
], StatsSummaryDto.prototype, "absent", void 0);
__decorate([
    ApiProperty({ example: 2 }),
    __metadata("design:type", Number)
], StatsSummaryDto.prototype, "pending", void 0);
__decorate([
    ApiProperty({ example: 10 }),
    __metadata("design:type", Number)
], StatsSummaryDto.prototype, "attendedOpen", void 0);
__decorate([
    ApiProperty({ example: 90 }),
    __metadata("design:type", Number)
], StatsSummaryDto.prototype, "attendedSettled", void 0);
__decorate([
    ApiProperty({ example: 90 }),
    __metadata("design:type", Number)
], StatsSummaryDto.prototype, "present", void 0);
__decorate([
    ApiProperty({ example: 95 }),
    __metadata("design:type", Number)
], StatsSummaryDto.prototype, "settled", void 0);
__decorate([
    ApiProperty({ example: 'settled' }),
    __metadata("design:type", String)
], StatsSummaryDto.prototype, "rateBasis", void 0);
__decorate([
    ApiProperty({ example: 94.7 }),
    __metadata("design:type", Number)
], StatsSummaryDto.prototype, "rate", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Array)
], StatsSummaryDto.prototype, "perBranch", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Array)
], StatsSummaryDto.prototype, "perGroup", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Array)
], StatsSummaryDto.prototype, "perShift", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Array)
], StatsSummaryDto.prototype, "perBranchStatus", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Array)
], StatsSummaryDto.prototype, "perDay", void 0);
export class ProbeItemDto {
    member_id;
    date;
    shift_name;
    type;
    path;
    at;
    face_score;
}
__decorate([
    ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], ProbeItemDto.prototype, "member_id", void 0);
__decorate([
    ApiProperty({ example: '2026-09-10' }),
    __metadata("design:type", String)
], ProbeItemDto.prototype, "date", void 0);
__decorate([
    ApiPropertyOptional({ example: 'Morning Shift' }),
    __metadata("design:type", Object)
], ProbeItemDto.prototype, "shift_name", void 0);
__decorate([
    ApiProperty({ example: 'check_in' }),
    __metadata("design:type", String)
], ProbeItemDto.prototype, "type", void 0);
__decorate([
    ApiPropertyOptional({ example: 'group/2026_01/probe.jpg' }),
    __metadata("design:type", Object)
], ProbeItemDto.prototype, "path", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z' }),
    __metadata("design:type", Object)
], ProbeItemDto.prototype, "at", void 0);
__decorate([
    ApiPropertyOptional({ example: 0.95 }),
    __metadata("design:type", Object)
], ProbeItemDto.prototype, "face_score", void 0);
//# sourceMappingURL=reports.dto.js.map