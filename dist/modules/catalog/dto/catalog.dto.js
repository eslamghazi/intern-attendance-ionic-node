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
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, } from 'class-validator';
/* --- Institutions --- */
export class CreateInstitutionDto {
    name;
    code = 0;
}
__decorate([
    ApiProperty({ example: 'Cairo University', description: 'Institution name' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], CreateInstitutionDto.prototype, "name", void 0);
__decorate([
    ApiPropertyOptional({ example: 101, default: 0, description: 'Institution numeric code' }),
    IsOptional(),
    IsInt(),
    __metadata("design:type", Number)
], CreateInstitutionDto.prototype, "code", void 0);
export class UpdateInstitutionDto {
    name;
    code;
}
__decorate([
    ApiProperty({ example: 'Cairo University - Updated' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], UpdateInstitutionDto.prototype, "name", void 0);
__decorate([
    ApiPropertyOptional({ example: 102 }),
    IsOptional(),
    IsInt(),
    __metadata("design:type", Number)
], UpdateInstitutionDto.prototype, "code", void 0);
export class InstitutionResponseDto {
    id;
    name;
    code;
    created_at;
}
__decorate([
    ApiProperty({ example: 'c8d0e513-5b8b-4c74-8b6b-1a5ec4c74567' }),
    __metadata("design:type", String)
], InstitutionResponseDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'Cairo University' }),
    __metadata("design:type", String)
], InstitutionResponseDto.prototype, "name", void 0);
__decorate([
    ApiProperty({ example: 101 }),
    __metadata("design:type", Number)
], InstitutionResponseDto.prototype, "code", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' }),
    __metadata("design:type", Object)
], InstitutionResponseDto.prototype, "created_at", void 0);
/* --- Branches --- */
export class CreateBranchDto {
    name;
    address;
    latitude;
    longitude;
    radius_meters;
    // JsonValue[], not LatLng[]: this is what a client SENT, and it has not been
    // checked yet. CatalogService.validatedRing is what turns it into a ring, and
    // it is the only thing allowed to say it is one.
    area_coords;
    institution_id;
    bypass_face = false;
    bypass_location = false;
    bypass_checkout_window = false;
    require_qr = false;
    qr_enabled = true;
    block_checkin = false;
}
__decorate([
    ApiProperty({ example: 'Main Branch' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], CreateBranchDto.prototype, "name", void 0);
__decorate([
    ApiPropertyOptional({ example: '123 Nile St, Giza' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], CreateBranchDto.prototype, "address", void 0);
__decorate([
    ApiProperty({ example: 30.0444 }),
    IsNumber(),
    __metadata("design:type", Number)
], CreateBranchDto.prototype, "latitude", void 0);
__decorate([
    ApiProperty({ example: 31.2357 }),
    IsNumber(),
    __metadata("design:type", Number)
], CreateBranchDto.prototype, "longitude", void 0);
__decorate([
    ApiProperty({ example: 100, description: 'Geofence radius in meters' }),
    IsInt(),
    __metadata("design:type", Number)
], CreateBranchDto.prototype, "radius_meters", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Optional polygon area coordinates', type: 'array', items: { type: 'object' } }),
    IsOptional(),
    IsArray(),
    __metadata("design:type", Object)
], CreateBranchDto.prototype, "area_coords", void 0);
__decorate([
    ApiPropertyOptional({ example: 'c8d0e513-5b8b-4c74-8b6b-1a5ec4c74567' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", Object)
], CreateBranchDto.prototype, "institution_id", void 0);
__decorate([
    ApiPropertyOptional({ default: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateBranchDto.prototype, "bypass_face", void 0);
__decorate([
    ApiPropertyOptional({ default: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateBranchDto.prototype, "bypass_location", void 0);
__decorate([
    ApiPropertyOptional({ default: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateBranchDto.prototype, "bypass_checkout_window", void 0);
__decorate([
    ApiPropertyOptional({ default: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateBranchDto.prototype, "require_qr", void 0);
__decorate([
    ApiPropertyOptional({ default: true }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateBranchDto.prototype, "qr_enabled", void 0);
__decorate([
    ApiPropertyOptional({ default: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateBranchDto.prototype, "block_checkin", void 0);
export class UpdateBranchDto extends CreateBranchDto {
}
export class BranchResponseDto {
    id;
    name;
    address;
    latitude;
    longitude;
    radius_meters;
    institution_id;
    bypass_face;
    bypass_location;
    bypass_checkout_window;
    require_qr;
    qr_enabled;
    block_checkin;
}
__decorate([
    ApiProperty({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    __metadata("design:type", String)
], BranchResponseDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'Main Branch' }),
    __metadata("design:type", String)
], BranchResponseDto.prototype, "name", void 0);
__decorate([
    ApiPropertyOptional({ example: '123 Nile St, Giza' }),
    __metadata("design:type", Object)
], BranchResponseDto.prototype, "address", void 0);
__decorate([
    ApiProperty({ example: 30.0444 }),
    __metadata("design:type", Number)
], BranchResponseDto.prototype, "latitude", void 0);
__decorate([
    ApiProperty({ example: 31.2357 }),
    __metadata("design:type", Number)
], BranchResponseDto.prototype, "longitude", void 0);
__decorate([
    ApiProperty({ example: 100 }),
    __metadata("design:type", Number)
], BranchResponseDto.prototype, "radius_meters", void 0);
__decorate([
    ApiPropertyOptional({ example: 'c8d0e513-5b8b-4c74-8b6b-1a5ec4c74567' }),
    __metadata("design:type", Object)
], BranchResponseDto.prototype, "institution_id", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], BranchResponseDto.prototype, "bypass_face", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], BranchResponseDto.prototype, "bypass_location", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], BranchResponseDto.prototype, "bypass_checkout_window", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], BranchResponseDto.prototype, "require_qr", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    __metadata("design:type", Object)
], BranchResponseDto.prototype, "qr_enabled", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], BranchResponseDto.prototype, "block_checkin", void 0);
export class BranchOptionResponseDto {
    id;
    name;
}
__decorate([
    ApiProperty({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    __metadata("design:type", String)
], BranchOptionResponseDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'Main Branch' }),
    __metadata("design:type", String)
], BranchOptionResponseDto.prototype, "name", void 0);
/* --- Groups --- */
export class CreateGroupDto {
    name;
    year;
    institution_id;
    branch_id;
    start_date;
    end_date;
    bypass_face = false;
    bypass_location = false;
    bypass_checkout_window = false;
}
__decorate([
    ApiProperty({ example: 'Interns 2026' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], CreateGroupDto.prototype, "name", void 0);
__decorate([
    ApiProperty({ example: 2026 }),
    IsInt(),
    __metadata("design:type", Number)
], CreateGroupDto.prototype, "year", void 0);
__decorate([
    ApiPropertyOptional({ example: 'c8d0e513-5b8b-4c74-8b6b-1a5ec4c74567' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", Object)
], CreateGroupDto.prototype, "institution_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", Object)
], CreateGroupDto.prototype, "branch_id", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-01-01' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], CreateGroupDto.prototype, "start_date", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-12-31' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], CreateGroupDto.prototype, "end_date", void 0);
__decorate([
    ApiPropertyOptional({ default: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateGroupDto.prototype, "bypass_face", void 0);
__decorate([
    ApiPropertyOptional({ default: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateGroupDto.prototype, "bypass_location", void 0);
__decorate([
    ApiPropertyOptional({ default: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateGroupDto.prototype, "bypass_checkout_window", void 0);
export class UpdateGroupDto extends CreateGroupDto {
}
export class GroupResponseDto {
    id;
    name;
    year;
    institution_id;
    branch_id;
    start_date;
    end_date;
    bypass_face;
    bypass_location;
    bypass_checkout_window;
}
__decorate([
    ApiProperty({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' }),
    __metadata("design:type", String)
], GroupResponseDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'Interns 2026' }),
    __metadata("design:type", String)
], GroupResponseDto.prototype, "name", void 0);
__decorate([
    ApiProperty({ example: 2026 }),
    __metadata("design:type", Number)
], GroupResponseDto.prototype, "year", void 0);
__decorate([
    ApiPropertyOptional({ example: 'c8d0e513-5b8b-4c74-8b6b-1a5ec4c74567' }),
    __metadata("design:type", Object)
], GroupResponseDto.prototype, "institution_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' }),
    __metadata("design:type", Object)
], GroupResponseDto.prototype, "branch_id", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-01-01' }),
    __metadata("design:type", Object)
], GroupResponseDto.prototype, "start_date", void 0);
__decorate([
    ApiPropertyOptional({ example: '2026-12-31' }),
    __metadata("design:type", Object)
], GroupResponseDto.prototype, "end_date", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], GroupResponseDto.prototype, "bypass_face", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], GroupResponseDto.prototype, "bypass_location", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], GroupResponseDto.prototype, "bypass_checkout_window", void 0);
export class GroupOptionResponseDto {
    id;
    name;
}
__decorate([
    ApiProperty({ example: 'g1d0e513-5b8b-4c74-8b6b-1a5ec4c74999' }),
    __metadata("design:type", String)
], GroupOptionResponseDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'Interns 2026' }),
    __metadata("design:type", String)
], GroupOptionResponseDto.prototype, "name", void 0);
/* --- Shifts --- */
export class CreateShiftDto {
    name;
    key;
    checkin_open;
    checkin_late;
    checkin_close;
    checkout_open;
    checkout_close;
    start_time;
    end_time;
}
__decorate([
    ApiProperty({ example: 'Morning Shift' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], CreateShiftDto.prototype, "name", void 0);
__decorate([
    ApiPropertyOptional({ example: 'MORNING' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], CreateShiftDto.prototype, "key", void 0);
__decorate([
    ApiPropertyOptional({ example: '08:00' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], CreateShiftDto.prototype, "checkin_open", void 0);
__decorate([
    ApiPropertyOptional({ example: '09:30' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], CreateShiftDto.prototype, "checkin_late", void 0);
__decorate([
    ApiPropertyOptional({ example: '10:00' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], CreateShiftDto.prototype, "checkin_close", void 0);
__decorate([
    ApiPropertyOptional({ example: '16:00' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], CreateShiftDto.prototype, "checkout_open", void 0);
__decorate([
    ApiPropertyOptional({ example: '18:00' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], CreateShiftDto.prototype, "checkout_close", void 0);
__decorate([
    ApiProperty({ example: '09:00' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], CreateShiftDto.prototype, "start_time", void 0);
__decorate([
    ApiProperty({ example: '17:00' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], CreateShiftDto.prototype, "end_time", void 0);
export class UpdateShiftDto extends CreateShiftDto {
}
export class ShiftResponseDto {
    id;
    name;
    key;
    checkin_open;
    checkin_late;
    checkin_close;
    checkout_open;
    checkout_close;
    start_time;
    end_time;
}
__decorate([
    ApiProperty({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74333' }),
    __metadata("design:type", String)
], ShiftResponseDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'Morning Shift' }),
    __metadata("design:type", String)
], ShiftResponseDto.prototype, "name", void 0);
__decorate([
    ApiPropertyOptional({ example: 'MORNING' }),
    __metadata("design:type", Object)
], ShiftResponseDto.prototype, "key", void 0);
__decorate([
    ApiPropertyOptional({ example: '08:00' }),
    __metadata("design:type", Object)
], ShiftResponseDto.prototype, "checkin_open", void 0);
__decorate([
    ApiPropertyOptional({ example: '09:30' }),
    __metadata("design:type", Object)
], ShiftResponseDto.prototype, "checkin_late", void 0);
__decorate([
    ApiPropertyOptional({ example: '10:00' }),
    __metadata("design:type", Object)
], ShiftResponseDto.prototype, "checkin_close", void 0);
__decorate([
    ApiPropertyOptional({ example: '16:00' }),
    __metadata("design:type", Object)
], ShiftResponseDto.prototype, "checkout_open", void 0);
__decorate([
    ApiPropertyOptional({ example: '18:00' }),
    __metadata("design:type", Object)
], ShiftResponseDto.prototype, "checkout_close", void 0);
__decorate([
    ApiProperty({ example: '09:00' }),
    __metadata("design:type", String)
], ShiftResponseDto.prototype, "start_time", void 0);
__decorate([
    ApiProperty({ example: '17:00' }),
    __metadata("design:type", String)
], ShiftResponseDto.prototype, "end_time", void 0);
export class ShiftKeyOptionResponseDto {
    id;
    key;
}
__decorate([
    ApiProperty({ example: 's1d0e513-5b8b-4c74-8b6b-1a5ec4c74333' }),
    __metadata("design:type", String)
], ShiftKeyOptionResponseDto.prototype, "id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'MORNING' }),
    __metadata("design:type", Object)
], ShiftKeyOptionResponseDto.prototype, "key", void 0);
//# sourceMappingURL=catalog.dto.js.map