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
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateIf, } from 'class-validator';
import { MASTER_PASSWORD_MIN } from '../../../config/constants.js';
export class BrandingResponseDto {
    org_name;
    org_logo_url;
    terminology;
    member_photos;
}
__decorate([
    ApiPropertyOptional({ example: 'Calaix Attendance' }),
    __metadata("design:type", Object)
], BrandingResponseDto.prototype, "org_name", void 0);
__decorate([
    ApiPropertyOptional({ example: 'https://example.com/logo.png' }),
    __metadata("design:type", Object)
], BrandingResponseDto.prototype, "org_logo_url", void 0);
__decorate([
    ApiPropertyOptional({ example: 'interns' }),
    __metadata("design:type", Object)
], BrandingResponseDto.prototype, "terminology", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    __metadata("design:type", Object)
], BrandingResponseDto.prototype, "member_photos", void 0);
export class SettingsResponseDto {
    face_match_threshold;
    liveness_required;
    liveness_mode;
    default_radius_meters;
    max_accuracy_meters;
    late_grace_minutes;
    require_play_integrity;
    bypass_face;
    bypass_location;
    store_face_images;
    store_probe_images;
    qr_requires_member;
    qr_allow_image;
    qr_validity_seconds;
    qr_bypass_minutes;
    enforce_shift_window;
    auto_leave_work;
    bypass_checkout_window;
    capture_hold_seconds;
    org_name;
    org_logo_url;
    terminology;
    member_photos;
    show_out_of_range_map;
    block_dev_options;
    location_ip_max_km;
    web_detect_frozen_gps;
    checkin_method;
}
__decorate([
    ApiPropertyOptional({ example: 0.85 }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "face_match_threshold", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "liveness_required", void 0);
__decorate([
    ApiPropertyOptional({ example: 'passive' }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "liveness_mode", void 0);
__decorate([
    ApiPropertyOptional({ example: 50 }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "default_radius_meters", void 0);
__decorate([
    ApiPropertyOptional({ example: 100 }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "max_accuracy_meters", void 0);
__decorate([
    ApiPropertyOptional({ example: 15 }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "late_grace_minutes", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "require_play_integrity", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "bypass_face", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "bypass_location", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "store_face_images", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "store_probe_images", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "qr_requires_member", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "qr_allow_image", void 0);
__decorate([
    ApiPropertyOptional({ example: 30 }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "qr_validity_seconds", void 0);
__decorate([
    ApiPropertyOptional({ example: 5 }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "qr_bypass_minutes", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "enforce_shift_window", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "auto_leave_work", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "bypass_checkout_window", void 0);
__decorate([
    ApiPropertyOptional({ example: 3 }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "capture_hold_seconds", void 0);
__decorate([
    ApiPropertyOptional({ example: 'Calaix Attendance' }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "org_name", void 0);
__decorate([
    ApiPropertyOptional({ example: 'https://example.com/logo.png' }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "org_logo_url", void 0);
__decorate([
    ApiPropertyOptional({ example: 'interns' }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "terminology", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "member_photos", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "show_out_of_range_map", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "block_dev_options", void 0);
__decorate([
    ApiPropertyOptional({ example: 100 }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "location_ip_max_km", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "web_detect_frozen_gps", void 0);
__decorate([
    ApiPropertyOptional({ example: 'face' }),
    __metadata("design:type", Object)
], SettingsResponseDto.prototype, "checkin_method", void 0);
export class UpdateSettingsDto {
    face_match_threshold;
    liveness_required;
    liveness_mode;
    default_radius_meters;
    max_accuracy_meters;
    late_grace_minutes;
    require_play_integrity;
    bypass_face;
    bypass_location;
    store_face_images;
    store_probe_images;
    qr_requires_member;
    qr_allow_image;
    qr_validity_seconds;
    qr_bypass_minutes;
    enforce_shift_window;
    auto_leave_work;
    bypass_checkout_window;
    capture_hold_seconds;
    org_name;
    org_logo_url;
    terminology;
    member_photos;
    show_out_of_range_map;
    block_dev_options;
    location_ip_max_km;
    web_detect_frozen_gps;
    checkin_method;
}
__decorate([
    ApiPropertyOptional({ example: 0.85 }),
    IsOptional(),
    IsNumber(),
    __metadata("design:type", Number)
], UpdateSettingsDto.prototype, "face_match_threshold", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "liveness_required", void 0);
__decorate([
    ApiPropertyOptional({ example: 'passive' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], UpdateSettingsDto.prototype, "liveness_mode", void 0);
__decorate([
    ApiPropertyOptional({ example: 50 }),
    IsOptional(),
    IsInt(),
    Min(5),
    __metadata("design:type", Number)
], UpdateSettingsDto.prototype, "default_radius_meters", void 0);
__decorate([
    ApiPropertyOptional({ example: 100 }),
    IsOptional(),
    IsInt(),
    Min(5),
    __metadata("design:type", Number)
], UpdateSettingsDto.prototype, "max_accuracy_meters", void 0);
__decorate([
    ApiPropertyOptional({ example: 15 }),
    IsOptional(),
    IsInt(),
    __metadata("design:type", Number)
], UpdateSettingsDto.prototype, "late_grace_minutes", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "require_play_integrity", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "bypass_face", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "bypass_location", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "store_face_images", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "store_probe_images", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "qr_requires_member", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "qr_allow_image", void 0);
__decorate([
    ApiPropertyOptional({ example: 30 }),
    IsOptional(),
    IsInt(),
    __metadata("design:type", Number)
], UpdateSettingsDto.prototype, "qr_validity_seconds", void 0);
__decorate([
    ApiPropertyOptional({ example: 5 }),
    IsOptional(),
    IsInt(),
    __metadata("design:type", Number)
], UpdateSettingsDto.prototype, "qr_bypass_minutes", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "enforce_shift_window", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "auto_leave_work", void 0);
__decorate([
    ApiPropertyOptional({ example: false }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "bypass_checkout_window", void 0);
__decorate([
    ApiPropertyOptional({ example: 3 }),
    IsOptional(),
    IsInt(),
    __metadata("design:type", Number)
], UpdateSettingsDto.prototype, "capture_hold_seconds", void 0);
__decorate([
    ApiPropertyOptional({ example: 'Calaix Attendance' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], UpdateSettingsDto.prototype, "org_name", void 0);
__decorate([
    ApiPropertyOptional({ example: 'https://example.com/logo.png' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], UpdateSettingsDto.prototype, "org_logo_url", void 0);
__decorate([
    ApiPropertyOptional({ example: 'interns' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], UpdateSettingsDto.prototype, "terminology", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "member_photos", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "show_out_of_range_map", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "block_dev_options", void 0);
__decorate([
    ApiPropertyOptional({ example: 100 }),
    IsOptional(),
    IsInt(),
    __metadata("design:type", Number)
], UpdateSettingsDto.prototype, "location_ip_max_km", void 0);
__decorate([
    ApiPropertyOptional({ example: true }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateSettingsDto.prototype, "web_detect_frozen_gps", void 0);
__decorate([
    ApiPropertyOptional({ example: 'face' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], UpdateSettingsDto.prototype, "checkin_method", void 0);
export class MasterPasswordStatusResponseDto {
    configured;
    constructor(configured) {
        this.configured = configured;
    }
}
__decorate([
    ApiProperty({ example: true, description: 'Whether master password has been configured' }),
    __metadata("design:type", Boolean)
], MasterPasswordStatusResponseDto.prototype, "configured", void 0);
export class SetMasterPasswordDto {
    /**
     * The new master password, or '' to remove it.
     *
     * NOT @IsNotEmpty. The empty string is the only way to turn this off —
     * AuthService.setMasterPassword reads it as "store null" — and with a
     * not-empty rule on it the request was refused at validation, so a master
     * password that opens ANY admin account could be set and never withdrawn.
     * The service has always handled it; nothing could get it that far.
     *
     * @IsString stays: it is what refuses null, a number or an object, each of
     * which would otherwise reach bcrypt.
     */
    password;
}
__decorate([
    ApiProperty({
        example: 'SuperSecurePass123!',
        description: `New master password (min ${MASTER_PASSWORD_MIN} characters), or '' to clear it`,
    }),
    IsString()
    // Only when there IS one. `''` is the clear, and a length rule that applied to
    // it would make the master password impossible to withdraw again — which is
    // the bug this DTO already had once, from @IsNotEmpty.
    ,
    ValidateIf((o) => o.password !== ''),
    MinLength(MASTER_PASSWORD_MIN),
    __metadata("design:type", String)
], SetMasterPasswordDto.prototype, "password", void 0);
//# sourceMappingURL=settings.dto.js.map