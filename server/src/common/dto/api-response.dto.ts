import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { JsonObject, JsonValue } from '../json.types.js';

export class ApiResponse<T> {
  @ApiProperty({ example: true })
  ok: true;

  @ApiProperty({ description: 'Payload data' })
  data: T;

  @ApiPropertyOptional({ description: 'Human-readable response message in English or resolved language' })
  message?: string;

  @ApiPropertyOptional({ description: 'Human-readable response message in Arabic' })
  message_ar?: string;

  @ApiPropertyOptional({ description: 'Optional metadata' })
  meta?: JsonObject;

  constructor(
    data: T,
    meta?: JsonObject,
    messages?: { message?: string; message_ar?: string },
  ) {
    this.ok = true;
    this.data = data;
    this.meta = meta;
    if (messages?.message) this.message = messages.message;
    if (messages?.message_ar) this.message_ar = messages.message_ar;
  }
}

export class PaginatedResponse<T> {
  @ApiProperty({ example: true })
  ok: true;

  @ApiProperty({ description: 'List of items', isArray: true })
  data: T[];

  @ApiProperty({ example: 100, description: 'Total item count across all pages' })
  total: number;

  @ApiPropertyOptional({ description: 'Human-readable response message in English or resolved language' })
  message?: string;

  @ApiPropertyOptional({ description: 'Human-readable response message in Arabic' })
  message_ar?: string;

  @ApiPropertyOptional({ description: 'Optional pagination metadata' })
  meta?: JsonObject;

  constructor(
    data: T[],
    total: number,
    meta?: JsonObject,
    messages?: { message?: string; message_ar?: string },
  ) {
    this.ok = true;
    this.data = data;
    this.total = total;
    this.meta = meta;
    if (messages?.message) this.message = messages.message;
    if (messages?.message_ar) this.message_ar = messages.message_ar;
  }
}

export class ApiErrorDetail {
  @ApiProperty({ example: 'bad_request', description: 'Machine-readable error code' })
  code: string;

  @ApiProperty({ example: 'Invalid input parameters', description: 'Human-readable error description in English or resolved language' })
  message: string;

  @ApiPropertyOptional({ example: 'بيانات الطلب غير صالحة', description: 'Human-readable error description in Arabic' })
  message_ar?: string;

  @ApiPropertyOptional({ description: 'Detailed validation or domain errors' })
  details?: JsonValue;

  @ApiPropertyOptional({ description: 'Postgres SQL state and table info if applicable' })
  pg?: { code?: string; table?: string };

  constructor(
    code: string = 'internal_error',
    message: string = 'Internal error',
    details?: JsonValue,
    pg?: { code?: string; table?: string },
    message_ar?: string,
  ) {
    this.code = code;
    this.message = message;
    this.details = details;
    this.pg = pg;
    this.message_ar = message_ar;
  }
}

export class ApiErrorResponse {
  @ApiProperty({ example: false })
  ok: false;

  @ApiProperty({ type: ApiErrorDetail })
  error: ApiErrorDetail;

  constructor(error: ApiErrorDetail);
  constructor(code: string, message: string, details?: JsonValue, pg?: { code?: string; table?: string }, message_ar?: string);
  constructor(
    arg1: ApiErrorDetail | string,
    arg2?: string,
    details?: JsonValue,
    pg?: { code?: string; table?: string },
    message_ar?: string,
  ) {
    this.ok = false;
    if (typeof arg1 === 'string') {
      this.error = new ApiErrorDetail(arg1, arg2 || '', details, pg, message_ar);
    } else {
      this.error = arg1;
    }
  }
}

