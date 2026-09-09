import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class BrandingResponseDto {
  @ApiPropertyOptional({ example: 'Calaix Attendance' })
  org_name?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  org_logo_url?: string | null;

  @ApiPropertyOptional({ example: 'interns' })
  terminology?: string | null;

  @ApiPropertyOptional({ example: true })
  member_photos?: boolean | null;
}

export class SettingsResponseDto {
  @ApiPropertyOptional({ example: 0.85 })
  face_match_threshold?: number | null;

  @ApiPropertyOptional({ example: true })
  liveness_required?: boolean | null;

  @ApiPropertyOptional({ example: 'passive' })
  liveness_mode?: string | null;

  @ApiPropertyOptional({ example: 50 })
  default_radius_meters?: number | null;

  @ApiPropertyOptional({ example: 100 })
  max_accuracy_meters?: number | null;

  @ApiPropertyOptional({ example: 15 })
  late_grace_minutes?: number | null;

  @ApiPropertyOptional({ example: false })
  require_play_integrity?: boolean | null;

  @ApiPropertyOptional({ example: false })
  bypass_face?: boolean | null;

  @ApiPropertyOptional({ example: false })
  bypass_location?: boolean | null;

  @ApiPropertyOptional({ example: true })
  store_face_images?: boolean | null;

  @ApiPropertyOptional({ example: true })
  store_probe_images?: boolean | null;

  @ApiPropertyOptional({ example: false })
  qr_requires_member?: boolean | null;

  @ApiPropertyOptional({ example: false })
  qr_allow_image?: boolean | null;

  @ApiPropertyOptional({ example: 30 })
  qr_validity_seconds?: number | null;

  @ApiPropertyOptional({ example: 5 })
  qr_bypass_minutes?: number | null;

  @ApiPropertyOptional({ example: true })
  enforce_shift_window?: boolean | null;

  @ApiPropertyOptional({ example: false })
  auto_leave_work?: boolean | null;

  @ApiPropertyOptional({ example: false })
  bypass_checkout_window?: boolean | null;

  @ApiPropertyOptional({ example: 3 })
  capture_hold_seconds?: number | null;

  @ApiPropertyOptional({ example: 'Calaix Attendance' })
  org_name?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  org_logo_url?: string | null;

  @ApiPropertyOptional({ example: 'interns' })
  terminology?: string | null;

  @ApiPropertyOptional({ example: true })
  member_photos?: boolean | null;

  @ApiPropertyOptional({ example: true })
  show_out_of_range_map?: boolean | null;

  @ApiPropertyOptional({ example: true })
  block_dev_options?: boolean | null;

  @ApiPropertyOptional({ example: 100 })
  location_ip_max_km?: number | null;

  @ApiPropertyOptional({ example: true })
  web_detect_frozen_gps?: boolean | null;

  @ApiPropertyOptional({ example: 'face' })
  checkin_method?: string | null;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 0.85 })
  @IsOptional()
  @IsNumber()
  face_match_threshold?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  liveness_required?: boolean;

  @ApiPropertyOptional({ example: 'passive' })
  @IsOptional()
  @IsString()
  liveness_mode?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(5)
  default_radius_meters?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(5)
  max_accuracy_meters?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  late_grace_minutes?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  require_play_integrity?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  bypass_face?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  bypass_location?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  store_face_images?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  store_probe_images?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  qr_requires_member?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  qr_allow_image?: boolean;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  qr_validity_seconds?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  qr_bypass_minutes?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enforce_shift_window?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  auto_leave_work?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  bypass_checkout_window?: boolean;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  capture_hold_seconds?: number;

  @ApiPropertyOptional({ example: 'Calaix Attendance' })
  @IsOptional()
  @IsString()
  org_name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsString()
  org_logo_url?: string;

  @ApiPropertyOptional({ example: 'interns' })
  @IsOptional()
  @IsString()
  terminology?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  member_photos?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  show_out_of_range_map?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  block_dev_options?: boolean;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  location_ip_max_km?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  web_detect_frozen_gps?: boolean;

  @ApiPropertyOptional({ example: 'face' })
  @IsOptional()
  @IsString()
  checkin_method?: string;
}

export class MasterPasswordStatusResponseDto {
  @ApiProperty({ example: true, description: 'Whether master password has been configured' })
  configured: boolean;

  constructor(configured: boolean) {
    this.configured = configured;
  }
}

export class SetMasterPasswordDto {
  @ApiProperty({ example: 'SuperSecurePass123!', description: 'New master password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
