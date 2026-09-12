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

export class PresencePendingMemberDto {
  @ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  member_id!: string;

  @ApiProperty({ example: 'Ahmed Mohamed' })
  full_name!: string;
}

export class PresenceCheckRowDto {
  @ApiProperty({ example: 'c1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  id!: string;

  @ApiPropertyOptional()
  created_by!: string | null;

  @ApiPropertyOptional()
  branch_id!: string | null;

  @ApiPropertyOptional()
  group_id!: string | null;

  @ApiPropertyOptional()
  department_id!: string | null;

  @ApiPropertyOptional()
  shift_id!: string | null;

  @ApiProperty({ example: '2026-09-10' })
  date!: string;

  @ApiProperty({ example: '2026-09-10T08:15:00.000Z' })
  deadline!: string;

  @ApiProperty({ type: [String] })
  target_member_ids!: string[];

  @ApiProperty({ example: 'open' })
  status!: string;

  @ApiPropertyOptional()
  decision!: string | null;

  @ApiProperty()
  created_at!: Date | string;

  @ApiPropertyOptional()
  resolved_at!: Date | string | null;

  @ApiProperty({ example: 25 })
  target_count!: number;

  @ApiProperty({ example: 18 })
  confirmed_count!: number;

  @ApiProperty({ example: false })
  past_deadline!: boolean;

  @ApiProperty({ type: [PresencePendingMemberDto] })
  pending!: PresencePendingMemberDto[];
}

export class PresenceChecksResponseDto {
  @ApiProperty({ type: [PresenceCheckRowDto] })
  checks!: PresenceCheckRowDto[];
}

export class ResolveCheckResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ example: 'keep' })
  decision!: string;
}

export class PendingCheckItemDto {
  @ApiProperty({ example: 'c1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' })
  check_id!: string;

  @ApiProperty({ example: '2026-09-10T08:15:00.000Z' })
  deadline!: string;
}

export class PendingPresenceResponseDto {
  @ApiPropertyOptional({ type: PendingCheckItemDto, nullable: true })
  pending!: PendingCheckItemDto | null;
}

export class ActionSuccessResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;
}

