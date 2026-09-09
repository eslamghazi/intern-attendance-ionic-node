import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecordAttendanceDto {
  @ApiProperty({ enum: ['check_in', 'check_out'], description: 'Type of check operation' })
  @IsIn(['check_in', 'check_out'])
  type!: 'check_in' | 'check_out';

  @ApiProperty({ description: 'GPS latitude', example: 30.0444 })
  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @ApiProperty({ description: 'GPS longitude', example: 31.2357 })
  @Type(() => Number)
  @IsNumber()
  lng!: number;

  @ApiProperty({ description: 'GPS accuracy in meters', example: 15 })
  @Type(() => Number)
  @IsNumber()
  accuracy!: number;

  @ApiPropertyOptional({ description: 'Flag if mock location was detected', default: false })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  is_mock?: boolean = false;

  @ApiPropertyOptional({ description: 'Whether client-side liveness check passed', default: false })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  liveness_passed?: boolean = false;

  @ApiPropertyOptional({ description: 'Cosine similarity face match score', nullable: true })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  face_score?: number | null;

  @ApiPropertyOptional({ description: 'Storage path for pre-uploaded probe image', nullable: true })
  @IsString()
  @IsOptional()
  probe_path?: string | null;

  @ApiPropertyOptional({ description: 'Base64 encoded JPEG probe image', nullable: true })
  @IsString()
  @IsOptional()
  probe_base64?: string | null;

  @ApiPropertyOptional({ description: 'Device play integrity token', nullable: true })
  @IsString()
  @IsOptional()
  integrity_token?: string | null;

  @ApiPropertyOptional({ description: 'QR redemption token for location bypass', nullable: true })
  @IsString()
  @IsOptional()
  qr_token?: string | null;

  @ApiPropertyOptional({ description: 'Shift UUID', nullable: true })
  @IsUUID()
  @IsOptional()
  shift_id?: string | null;
}

export class SetManualAttendanceDto {
  @ApiProperty({ description: 'Member UUID' })
  @IsUUID()
  @IsNotEmpty()
  member_id!: string;

  @ApiProperty({ description: 'Date (YYYY-MM-DD)', example: '2026-09-10' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiPropertyOptional({
    description: 'Attendance status',
    enum: ['present', 'late', 'absent', 'early_leave'],
  })
  @IsIn(['present', 'late', 'absent', 'early_leave'])
  @IsOptional()
  status?: 'present' | 'late' | 'absent' | 'early_leave';

  @ApiPropertyOptional({ description: 'Whether to clear manual attendance record', default: false })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  clear?: boolean = false;

  @ApiPropertyOptional({ description: 'Shift UUID', nullable: true })
  @IsUUID()
  @IsOptional()
  shift_id?: string | null;
}

export class AttendanceResultDto {
  @ApiProperty({ description: 'Resulting attendance status' })
  status!: string;

  @ApiPropertyOptional({ description: 'Recorded server timestamp' })
  time?: string;

  @ApiPropertyOptional({ description: 'Shift name' })
  shift_name?: string;
}
