import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class MintQrDto {
  @ApiPropertyOptional({ description: 'Branch UUID (optional for members with branch assigned)' })
  @IsUUID()
  @IsOptional()
  branch_id?: string;

  @ApiProperty({ description: 'Target date (YYYY-MM-DD)', example: '2026-09-10' })
  @IsString()
  @IsNotEmpty()
  date!: string;

  @ApiPropertyOptional({ description: 'Optional specific member UUID for member-bound QR' })
  @IsUUID()
  @IsOptional()
  member_id?: string | null;
}

export class RedeemQrDto {
  @ApiProperty({ description: 'QR token code' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class MintQrResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ description: 'Minted QR token string' })
  token!: string;

  @ApiProperty({ description: 'Active date' })
  date!: string;

  @ApiProperty({ description: 'Validity duration in seconds' })
  validity_seconds!: number;
}

export class RedeemQrResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiPropertyOptional({ description: 'Timestamp until which GPS location checks are bypassed' })
  until?: string | null;

  @ApiProperty({ description: 'Bypass duration granted in minutes' })
  minutes!: number;
}
