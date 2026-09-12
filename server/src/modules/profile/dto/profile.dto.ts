import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Dr. Sarah Connor' })
  @IsString()
  @IsNotEmpty()
  full_name!: string;

  @ApiPropertyOptional({ example: '+201001234567' })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ example: 'sarah@example.com' })
  @IsOptional()
  @IsString()
  email?: string | null;

  @ApiProperty({ example: '29001011234567' })
  @IsString()
  @IsNotEmpty()
  national_id!: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatar_url?: string | null;
}

export class MemberCodeResponseDto {
  @ApiPropertyOptional({ example: '1042' })
  code!: string | null;
}

export class ProfileResponseDto {
  @ApiProperty({ example: 'p1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  id!: string;

  @ApiProperty({ example: 'Dr. Sarah Connor' })
  full_name!: string;

  @ApiProperty({ example: '29001011234567' })
  national_id!: string;

  @ApiPropertyOptional({ example: '+201001234567' })
  phone!: string | null;

  @ApiPropertyOptional({ example: 'sarah@example.com' })
  email!: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatar_url!: string | null;
}
