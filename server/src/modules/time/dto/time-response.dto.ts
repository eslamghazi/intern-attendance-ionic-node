import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ServerNowResponseDto {
  @ApiProperty({ example: '2026-09-10', description: 'Server date in Africa/Cairo (yyyy-MM-dd)' })
  date!: string;

  @ApiProperty({ example: '09:00:00', description: 'Server time in Africa/Cairo (HH:mm:ss)' })
  time!: string;

  @ApiPropertyOptional({ example: false, description: 'Whether the clock is artificially frozen' })
  frozen?: boolean;

  @ApiPropertyOptional({ example: '2026-09-10', description: 'Real system date if frozen' })
  real_date?: string;

  @ApiPropertyOptional({ example: '09:00:00', description: 'Real system time if frozen' })
  real_time?: string;
}

export type ServerNow = ServerNowResponseDto;
