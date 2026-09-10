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
import { IsString, IsNotEmpty, IsIn, IsNumber, IsBoolean, IsOptional, IsUUID, Matches, } from 'class-validator';
import { Type } from 'class-transformer';
import { CheckType, AttendanceStatus } from '../../../common/enums/index.js';
export class RecordAttendanceDto {
    type;
    lat;
    lng;
    accuracy;
    is_mock = false;
    liveness_passed = false;
    face_score;
    probe_path;
    probe_base64;
    integrity_token;
    qr_token;
    shift_id;
}
__decorate([
    ApiProperty({ enum: CheckType, description: 'Type of check operation' }),
    IsIn(Object.values(CheckType)),
    __metadata("design:type", String)
], RecordAttendanceDto.prototype, "type", void 0);
__decorate([
    ApiProperty({ description: 'GPS latitude', example: 30.0444 }),
    Type(() => Number),
    IsNumber(),
    __metadata("design:type", Number)
], RecordAttendanceDto.prototype, "lat", void 0);
__decorate([
    ApiProperty({ description: 'GPS longitude', example: 31.2357 }),
    Type(() => Number),
    IsNumber(),
    __metadata("design:type", Number)
], RecordAttendanceDto.prototype, "lng", void 0);
__decorate([
    ApiProperty({ description: 'GPS accuracy in meters', example: 15 }),
    Type(() => Number),
    IsNumber(),
    __metadata("design:type", Number)
], RecordAttendanceDto.prototype, "accuracy", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Flag if mock location was detected', default: false }),
    Type(() => Boolean),
    IsBoolean(),
    IsOptional(),
    __metadata("design:type", Boolean)
], RecordAttendanceDto.prototype, "is_mock", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Whether client-side liveness check passed', default: false }),
    Type(() => Boolean),
    IsBoolean(),
    IsOptional(),
    __metadata("design:type", Boolean)
], RecordAttendanceDto.prototype, "liveness_passed", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Cosine similarity face match score', nullable: true }),
    Type(() => Number),
    IsNumber(),
    IsOptional(),
    __metadata("design:type", Object)
], RecordAttendanceDto.prototype, "face_score", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Storage path for pre-uploaded probe image', nullable: true }),
    IsString(),
    IsOptional(),
    __metadata("design:type", Object)
], RecordAttendanceDto.prototype, "probe_path", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Base64 encoded JPEG probe image', nullable: true }),
    IsString(),
    IsOptional(),
    __metadata("design:type", Object)
], RecordAttendanceDto.prototype, "probe_base64", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Device play integrity token', nullable: true }),
    IsString(),
    IsOptional(),
    __metadata("design:type", Object)
], RecordAttendanceDto.prototype, "integrity_token", void 0);
__decorate([
    ApiPropertyOptional({ description: 'QR redemption token for location bypass', nullable: true }),
    IsString(),
    IsOptional(),
    __metadata("design:type", Object)
], RecordAttendanceDto.prototype, "qr_token", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Shift UUID', nullable: true }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], RecordAttendanceDto.prototype, "shift_id", void 0);
export class SetManualAttendanceDto {
    member_id;
    date;
    status;
    clear = false;
    shift_id;
}
__decorate([
    ApiProperty({ description: 'Member UUID' }),
    IsUUID(),
    IsNotEmpty(),
    __metadata("design:type", String)
], SetManualAttendanceDto.prototype, "member_id", void 0);
__decorate([
    ApiProperty({ description: 'Date (YYYY-MM-DD)', example: '2026-09-10' }),
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], SetManualAttendanceDto.prototype, "date", void 0);
__decorate([
    ApiPropertyOptional({
        description: 'Attendance status',
        enum: AttendanceStatus,
    }),
    IsIn(Object.values(AttendanceStatus)),
    IsOptional(),
    __metadata("design:type", String)
], SetManualAttendanceDto.prototype, "status", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Whether to clear manual attendance record', default: false }),
    Type(() => Boolean),
    IsBoolean(),
    IsOptional(),
    __metadata("design:type", Boolean)
], SetManualAttendanceDto.prototype, "clear", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Shift UUID', nullable: true }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], SetManualAttendanceDto.prototype, "shift_id", void 0);
export class AttendanceResultDto {
    ok;
    type;
    status;
    distance;
    shift;
    time;
    shift_name;
}
__decorate([
    ApiProperty({ example: true }),
    __metadata("design:type", Boolean)
], AttendanceResultDto.prototype, "ok", void 0);
__decorate([
    ApiProperty({ enum: CheckType, description: 'Check type' }),
    __metadata("design:type", String)
], AttendanceResultDto.prototype, "type", void 0);
__decorate([
    ApiProperty({ description: 'Resulting attendance status' }),
    __metadata("design:type", String)
], AttendanceResultDto.prototype, "status", void 0);
__decorate([
    ApiProperty({ description: 'Distance to branch in meters', example: 12.5 }),
    __metadata("design:type", Number)
], AttendanceResultDto.prototype, "distance", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Shift name', nullable: true }),
    __metadata("design:type", Object)
], AttendanceResultDto.prototype, "shift", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-09-10T08:00:00.000Z', nullable: true }),
    __metadata("design:type", Object)
], AttendanceResultDto.prototype, "time", void 0);
__decorate([
    ApiPropertyOptional({ example: 'Morning Shift', nullable: true }),
    __metadata("design:type", Object)
], AttendanceResultDto.prototype, "shift_name", void 0);
export class SetAttendanceResponseDto {
    ok;
    cleared;
}
__decorate([
    ApiProperty({ example: true }),
    __metadata("design:type", Boolean)
], SetAttendanceResponseDto.prototype, "ok", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    __metadata("design:type", Boolean)
], SetAttendanceResponseDto.prototype, "cleared", void 0);
//# sourceMappingURL=attendance.dto.js.map