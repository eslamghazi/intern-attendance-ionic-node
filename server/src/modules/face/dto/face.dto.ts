import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsArray, IsOptional, IsNumber } from 'class-validator';

export class EnrollPhotoDto {
  @ApiProperty({ description: 'Base64 encoded JPEG image data' })
  @IsString()
  @IsNotEmpty()
  image_base64!: string;
}

export class ResetFaceDto {
  @ApiProperty({ description: 'Target member UUID' })
  @IsUUID()
  @IsNotEmpty()
  member_id!: string;
}

export class LookupFaceDto {
  @ApiProperty({ description: 'Member numeric or alphanumeric code' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class PutTemplateDto {
  @ApiProperty({ description: '512-dimension embedding vector as string format "[0.12, ...]"]' })
  @IsString()
  @IsNotEmpty()
  embedding!: string;

  @ApiPropertyOptional({ description: 'Photo storage relative path', nullable: true })
  @IsString()
  @IsOptional()
  photo_path?: string | null;

  @ApiPropertyOptional({ description: 'Quality assessment score', nullable: true })
  @IsNumber()
  @IsOptional()
  quality_score?: number | null;
}

export class GetTemplatePhotosDto {
  @ApiProperty({ description: 'List of member UUIDs', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  member_ids!: string[];
}

export class ToolResetDto {
  @ApiProperty({ description: 'Target member UUID' })
  @IsUUID()
  @IsNotEmpty()
  member_id!: string;
}

export class LookupFaceResponseDto {
  @ApiProperty({ description: 'Whether the member code was found' })
  found!: boolean;

  @ApiPropertyOptional({ description: 'Member UUID' })
  member_id?: string;

  @ApiPropertyOptional({ description: 'Member numeric code' })
  member_code?: string | null;

  @ApiPropertyOptional({ description: 'Full name' })
  full_name?: string;

  @ApiPropertyOptional({ description: 'Whether the member has a face biometric enrolled' })
  enrolled?: boolean;
}

export class TemplateResponseDto {
  @ApiPropertyOptional({ description: 'Embedding vector array or string', nullable: true })
  embedding!: number[] | string | null;
}


export class TemplatePhotoItemDto {
  @ApiProperty({ description: 'Member UUID' })
  member_id!: string;

  @ApiPropertyOptional({ description: 'Stored photo path', nullable: true })
  photo_path!: string | null;

  @ApiProperty({ description: 'Creation date' })
  created_at!: Date;
}
