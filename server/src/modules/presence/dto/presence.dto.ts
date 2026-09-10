import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsInt, Min, IsNotEmpty, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PresenceDecision } from '../../../common/enums/index.js';

export class CreatePresenceCheckDto {
  @ApiPropertyOptional({ description: 'Target branch UUID' })
  @IsUUID()
  @IsOptional()
  branch_id?: string | null;

  @ApiPropertyOptional({ description: 'Target group UUID' })
  @IsUUID()
  @IsOptional()
  group_id?: string | null;

  @ApiPropertyOptional({ description: 'Target department UUID' })
  @IsUUID()
  @IsOptional()
  department_id?: string | null;

  @ApiPropertyOptional({ description: 'Target shift UUID' })
  @IsUUID()
  @IsOptional()
  shift_id?: string | null;

  @ApiPropertyOptional({ description: 'Response deadline in minutes', default: 10, example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  deadline_minutes?: number = 10;
}

export class ConfirmPresenceByAdminDto {
  @ApiProperty({ description: 'Target member UUID' })
  @IsUUID()
  @IsNotEmpty()
  member_id!: string;
}

export class ResolvePresenceCheckDto {
  @ApiPropertyOptional({ description: 'Resolution decision', enum: PresenceDecision, default: PresenceDecision.RESOLVED })
  @IsIn(Object.values(PresenceDecision))
  @IsOptional()
  decision?: PresenceDecision = PresenceDecision.RESOLVED;
}

export class ConfirmPresenceByMemberDto {
  @ApiProperty({ description: 'Presence check UUID' })
  @IsUUID()
  @IsNotEmpty()
  check_id!: string;
}

export class CreatePresenceCheckResponseDto {
  @ApiProperty()
  ok!: boolean;

  @ApiPropertyOptional()
  check_id?: string;

  @ApiPropertyOptional()
  target_count?: number;

  @ApiPropertyOptional()
  deadline?: string;

  @ApiPropertyOptional()
  skipped?: boolean;
}
