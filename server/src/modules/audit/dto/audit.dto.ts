import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { AuditEvent } from '../../../common/enums/index.js';
import type { JsonValue } from '../../../common/json.types.js';

/**
 * What a caller may narrow the trail by.
 *
 * Every field is optional and every one is validated, because these reach a
 * WHERE clause. `event` is checked against the enum rather than passed through:
 * an unknown value would otherwise reach Postgres as a cast to `audit_event`
 * and come back as a 400 with a message about a type nobody asked about.
 */
export class AuditQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  page_size?: number;

  @ApiPropertyOptional({ enum: AuditEvent, isArray: true, description: 'Repeat to select several' })
  @IsOptional()
  @Type(() => String)
  @IsEnum(AuditEvent, { each: true })
  event?: AuditEvent | AuditEvent[];

  @ApiPropertyOptional({ description: 'Only events by this profile' })
  @IsOptional()
  @IsUUID()
  actor_id?: string;

  @ApiPropertyOptional({ description: 'Inclusive, ISO 8601' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Inclusive, ISO 8601' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  /**
   * Only the events that describe someone trying to get past a control, rather
   * than the ordinary traffic of people arriving at work. Without it the signal
   * is one row in a hundred.
   */
  @ApiPropertyOptional({ description: 'Only security-relevant events' })
  @IsOptional()
  @Type(() => String)
  security_only?: string;
}

export class AuditEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: AuditEvent })
  event!: string;

  @ApiProperty({ nullable: true, description: 'Null when the actor was deleted, or unknown' })
  actor_id!: string | null;

  @ApiProperty({ nullable: true })
  actor_name!: string | null;

  @ApiProperty({ nullable: true })
  actor_national_id!: string | null;

  @ApiProperty({ nullable: true })
  actor_role!: string | null;

  @ApiProperty({ nullable: true, description: 'Event-specific payload' })
  detail!: JsonValue;

  @ApiProperty()
  created_at!: string;
}
