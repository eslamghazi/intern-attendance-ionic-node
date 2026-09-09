import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponse<T> {
  @ApiProperty({ example: true })
  ok: true;

  @ApiProperty({ description: 'Payload data' })
  data: T;

  @ApiPropertyOptional({ description: 'Optional metadata' })
  meta?: Record<string, unknown>;

  constructor(data: T, meta?: Record<string, unknown>) {
    this.ok = true;
    this.data = data;
    this.meta = meta;
  }
}

export class PaginatedResponse<T> {
  @ApiProperty({ example: true })
  ok: true;

  @ApiProperty({ description: 'List of items', isArray: true })
  data: T[];

  @ApiProperty({ example: 100, description: 'Total item count across all pages' })
  total: number;

  @ApiPropertyOptional({ description: 'Optional pagination metadata' })
  meta?: Record<string, unknown>;

  constructor(data: T[], total: number, meta?: Record<string, unknown>) {
    this.ok = true;
    this.data = data;
    this.total = total;
    this.meta = meta;
  }
}

export class ApiErrorDetail {
  @ApiProperty({ example: 'bad_request', description: 'Machine-readable error code' })
  code: string;

  @ApiProperty({ example: 'Invalid input parameters', description: 'Human-readable error description' })
  message: string;

  @ApiPropertyOptional({ description: 'Detailed validation or domain errors' })
  details?: unknown;

  @ApiPropertyOptional({ description: 'Postgres SQL state and table info if applicable' })
  pg?: { code?: string; table?: string };

  constructor(code: string = 'internal_error', message: string = 'Internal error', details?: unknown, pg?: { code?: string; table?: string }) {
    this.code = code;
    this.message = message;
    this.details = details;
    this.pg = pg;
  }
}

export class ApiErrorResponse {
  @ApiProperty({ example: false })
  ok: false;

  @ApiProperty({ type: ApiErrorDetail })
  error: ApiErrorDetail;

  constructor(code: string, message: string, details?: unknown, pg?: { code?: string; table?: string }) {
    this.ok = false;
    this.error = new ApiErrorDetail(code, message, details, pg);
  }
}
