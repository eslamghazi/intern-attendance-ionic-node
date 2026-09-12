import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDefined, IsOptional } from 'class-validator';
import type { JsonValue } from '../../../common/json.types.js';
import type { RestoreLine } from '../../../domain/backup/types.js';

/** One superadmin, as the page lists them. Never carries a hash. */
export class SuperadminAccountDto {
  @ApiProperty({ example: 'a1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  id!: string;

  @ApiProperty({ example: 'Super Admin' })
  full_name!: string;

  @ApiProperty({ example: '30110281500753' })
  national_id!: string;

  @ApiPropertyOptional({ example: '+201001234567' })
  phone!: string | null;

  @ApiPropertyOptional({ example: 'admin@example.com' })
  email!: string | null;

  @ApiProperty({ example: true })
  is_active!: boolean;

  @ApiProperty({ example: '2026-09-12T05:11:55.000Z' })
  created_at!: string;
}

export class RestoreSuperadminDto {
  /**
   * The backup file's contents, verbatim.
   *
   * `JsonValue` rather than a shape: this came out of a file the caller chose,
   * and deciding whether it is a backup of ours is the job of
   * parseSuperadminBackup — which says WHICH account is wrong, where a DTO
   * validator would only say the body is invalid.
   */
  @ApiProperty({ description: 'The parsed contents of a backup file' })
  @IsDefined()
  file!: JsonValue;

  @ApiPropertyOptional({
    description: 'Replace accounts that already exist. Without it they are skipped.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}

export class RestoreResultDto {
  @ApiProperty({ example: 1 })
  added!: number;

  @ApiProperty({ example: 0 })
  overwritten!: number;

  @ApiProperty({ example: 0 })
  skipped!: number;

  @ApiProperty({ description: 'What happened to each account in the file' })
  accounts!: RestoreLine[];
}
