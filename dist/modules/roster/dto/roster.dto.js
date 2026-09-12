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
import { IsUUID, IsString, IsNotEmpty, IsInt, Min, Max, IsOptional, IsArray, IsIn, ValidateNested, } from 'class-validator';
import { Type } from 'class-transformer';
import { MemberFilterQueryDto } from '../../members/dto/member.dto.js';
export class MonthQueryDto {
    year;
    month;
}
__decorate([
    ApiProperty({ description: 'Year', example: 2026 }),
    Type(() => Number),
    IsInt(),
    __metadata("design:type", Number)
], MonthQueryDto.prototype, "year", void 0);
__decorate([
    ApiProperty({ description: 'Month (1-12)', example: 9 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(12),
    __metadata("design:type", Number)
], MonthQueryDto.prototype, "month", void 0);
export class RosterDayInputDto {
    member_id;
    date;
    shift_id;
}
__decorate([
    ApiProperty({ description: 'Member UUID' }),
    IsUUID(),
    IsNotEmpty(),
    __metadata("design:type", String)
], RosterDayInputDto.prototype, "member_id", void 0);
__decorate([
    ApiProperty({ description: 'Target date (YYYY-MM-DD)', example: '2026-09-10' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], RosterDayInputDto.prototype, "date", void 0);
__decorate([
    ApiProperty({ description: 'Assigned shift UUID' }),
    IsUUID(),
    IsNotEmpty(),
    __metadata("design:type", String)
], RosterDayInputDto.prototype, "shift_id", void 0);
export class GetRosterViewQueryDto extends MemberFilterQueryDto {
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
], GetRosterViewQueryDto.prototype, "year", void 0);
__decorate([
    ApiProperty({ description: 'Month (1-12)', example: 9 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(12),
    __metadata("design:type", Number)
], GetRosterViewQueryDto.prototype, "month", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Page number', default: 1 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    IsOptional(),
    __metadata("design:type", Number)
], GetRosterViewQueryDto.prototype, "page", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Page size', default: 50 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(MAX_PAGE_SIZE),
    IsOptional(),
    __metadata("design:type", Number)
], GetRosterViewQueryDto.prototype, "page_size", void 0);
export class GetExistingKeysDto {
    year;
    month;
    member_ids;
}
__decorate([
    ApiProperty({ description: 'Year', example: 2026 }),
    Type(() => Number),
    IsInt(),
    __metadata("design:type", Number)
], GetExistingKeysDto.prototype, "year", void 0);
__decorate([
    ApiProperty({ description: 'Month (1-12)', example: 9 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(12),
    __metadata("design:type", Number)
], GetExistingKeysDto.prototype, "month", void 0);
__decorate([
    ApiProperty({ description: 'List of member UUIDs', type: [String] }),
    IsArray(),
    IsUUID('4', { each: true }),
    __metadata("design:type", Array)
], GetExistingKeysDto.prototype, "member_ids", void 0);
export class PostRosterDaysDto {
    days;
    member_id;
    date;
    shift_id;
}
__decorate([
    ApiPropertyOptional({ type: [RosterDayInputDto] }),
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => RosterDayInputDto),
    IsOptional(),
    __metadata("design:type", Array)
], PostRosterDaysDto.prototype, "days", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Member UUID (if single day)' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", String)
], PostRosterDaysDto.prototype, "member_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Date (YYYY-MM-DD)' }),
    IsString(),
    IsOptional(),
    __metadata("design:type", String)
], PostRosterDaysDto.prototype, "date", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Shift UUID' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", String)
], PostRosterDaysDto.prototype, "shift_id", void 0);
export class BulkRosterDto extends MemberFilterQueryDto {
    year = 0;
    month = 0;
    shift_id;
    from_day;
    to_day;
    mode;
}
__decorate([
    ApiProperty({ description: 'Year', example: 2026 }),
    Type(() => Number),
    IsInt(),
    __metadata("design:type", Number)
], BulkRosterDto.prototype, "year", void 0);
__decorate([
    ApiProperty({ description: 'Month (1-12)', example: 9 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(12),
    __metadata("design:type", Number)
], BulkRosterDto.prototype, "month", void 0);
__decorate([
    ApiProperty({ description: 'Shift UUID' }),
    IsUUID(),
    IsNotEmpty(),
    __metadata("design:type", String)
], BulkRosterDto.prototype, "shift_id", void 0);
__decorate([
    ApiProperty({ description: 'Start day of the month', example: 1 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(31),
    __metadata("design:type", Number)
], BulkRosterDto.prototype, "from_day", void 0);
__decorate([
    ApiProperty({ description: 'End day of the month', example: 30 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(31),
    __metadata("design:type", Number)
], BulkRosterDto.prototype, "to_day", void 0);
__decorate([
    ApiProperty({ description: 'Operation mode', enum: ['add', 'remove', 'replace'] }),
    IsIn(['add', 'remove', 'replace']),
    __metadata("design:type", String)
], BulkRosterDto.prototype, "mode", void 0);
export class BulkRosterResultDto {
    members;
    added;
    removed;
}
__decorate([
    ApiProperty({ example: 20 }),
    __metadata("design:type", Number)
], BulkRosterResultDto.prototype, "members", void 0);
__decorate([
    ApiProperty({ example: 45 }),
    __metadata("design:type", Number)
], BulkRosterResultDto.prototype, "added", void 0);
__decorate([
    ApiProperty({ example: 5 }),
    __metadata("design:type", Number)
], BulkRosterResultDto.prototype, "removed", void 0);
export class RosterMakerMemberDto {
    member_id;
    code;
    full_name;
}
__decorate([
    ApiPropertyOptional({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", Object)
], RosterMakerMemberDto.prototype, "member_id", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026010107' }),
    __metadata("design:type", Object)
], RosterMakerMemberDto.prototype, "code", void 0);
__decorate([
    ApiPropertyOptional({ example: 'Ahmed Mohamed' }),
    __metadata("design:type", Object)
], RosterMakerMemberDto.prototype, "full_name", void 0);
export class RosterMakerShiftDto {
    id;
    key;
    name;
}
__decorate([
    ApiProperty({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' }),
    __metadata("design:type", String)
], RosterMakerShiftDto.prototype, "id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'M' }),
    __metadata("design:type", Object)
], RosterMakerShiftDto.prototype, "key", void 0);
__decorate([
    ApiProperty({ example: 'Morning Shift' }),
    __metadata("design:type", String)
], RosterMakerShiftDto.prototype, "name", void 0);
export class RosterMakerScheduleDto {
    member_id;
    day;
    key;
}
__decorate([
    ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], RosterMakerScheduleDto.prototype, "member_id", void 0);
__decorate([
    ApiProperty({ example: 10 }),
    __metadata("design:type", Number)
], RosterMakerScheduleDto.prototype, "day", void 0);
__decorate([
    ApiPropertyOptional({ example: 'M' }),
    __metadata("design:type", Object)
], RosterMakerScheduleDto.prototype, "key", void 0);
export class RosterMakerDataDto {
    members;
    shifts;
    roster;
}
__decorate([
    ApiProperty({ type: [RosterMakerMemberDto] }),
    __metadata("design:type", Array)
], RosterMakerDataDto.prototype, "members", void 0);
__decorate([
    ApiProperty({ type: [RosterMakerShiftDto] }),
    __metadata("design:type", Array)
], RosterMakerDataDto.prototype, "shifts", void 0);
__decorate([
    ApiProperty({ type: [RosterMakerScheduleDto] }),
    __metadata("design:type", Array)
], RosterMakerDataDto.prototype, "roster", void 0);
export class RosterCellDto {
    shift_id;
    label;
}
__decorate([
    ApiProperty({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' }),
    __metadata("design:type", String)
], RosterCellDto.prototype, "shift_id", void 0);
__decorate([
    ApiProperty({ example: 'M' }),
    __metadata("design:type", String)
], RosterCellDto.prototype, "label", void 0);
export class RosterViewRowDto {
    member_id;
    national_id;
    member_code;
    full_name;
    days;
}
__decorate([
    ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], RosterViewRowDto.prototype, "member_id", void 0);
__decorate([
    ApiProperty({ example: '29801011234567' }),
    __metadata("design:type", String)
], RosterViewRowDto.prototype, "national_id", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026010107' }),
    __metadata("design:type", Object)
], RosterViewRowDto.prototype, "member_code", void 0);
__decorate([
    ApiProperty({ example: 'Ahmed Mohamed' }),
    __metadata("design:type", String)
], RosterViewRowDto.prototype, "full_name", void 0);
__decorate([
    ApiProperty({ description: 'Day map containing array of shifts', example: { '1': [{ shift_id: 's1', label: 'M' }] } }),
    __metadata("design:type", Object)
], RosterViewRowDto.prototype, "days", void 0);
export class RosterTotalsResponseDto {
    perDay;
    perDayShift;
    total;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", Object)
], RosterTotalsResponseDto.prototype, "perDay", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Object)
], RosterTotalsResponseDto.prototype, "perDayShift", void 0);
__decorate([
    ApiProperty({ example: 42 }),
    __metadata("design:type", Number)
], RosterTotalsResponseDto.prototype, "total", void 0);
//# sourceMappingURL=roster.dto.js.map