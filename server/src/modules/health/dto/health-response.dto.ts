import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', description: 'System health status' })
  status: string;

  @ApiPropertyOptional({ example: true, description: 'Database connectivity flag' })
  db?: boolean;

  constructor(status: string, db?: boolean) {
    this.status = status;
    this.db = db;
  }
}
