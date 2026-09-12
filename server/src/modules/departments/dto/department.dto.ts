import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class DepartmentDto {
  @ApiProperty({ example: 'd1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' })
  id!: string;

  @ApiProperty({ example: 'Pediatrics' })
  name!: string;

  @ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  branch_id?: string | null;

  @ApiPropertyOptional({ example: 'Main Branch' })
  branch_name?: string | null;

  constructor(data: Partial<DepartmentDto>) {
    if (data.id) this.id = data.id;
    if (data.name) this.name = data.name;
    this.branch_id = data.branch_id ?? null;
    this.branch_name = data.branch_name ?? null;
  }
}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Pediatrics' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'b1d0e513-5b8b-4c74-8b6b-1a5ec4c74123' })
  @IsOptional()
  @IsUUID()
  branch_id?: string | null;
}

export class UpdateDepartmentDto extends CreateDepartmentDto {
  @ApiPropertyOptional({ example: 'd1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' })
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class PutMemberDepartmentDto {
  @ApiProperty({ example: 'm1d0e513-5b8b-4c74-8b6b-1a5ec4c74555' })
  @IsUUID()
  member_id!: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  year!: number;

  @ApiProperty({ example: 9 })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiPropertyOptional({ example: 'd1d0e513-5b8b-4c74-8b6b-1a5ec4c74111' })
  @IsOptional()
  @IsUUID()
  department_id?: string | null;
}
