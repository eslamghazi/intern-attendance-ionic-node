import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import type { Response, Request } from 'express';
import { toApiError } from '../../http/errors.js';
import { env } from '../../env.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const api = toApiError(exception);

    if (api.status >= 500) {
      console.error(`[API 5xx] ${request.method} ${request.url}:`, exception);
    }

    // Attendance refusals answer with their own `{ reason }` body
    if (api.payload) {
      return response.status(api.status).json(api.payload);
    }

    return response.status(api.status).json({
      error: {
        code: api.code,
        message: api.status >= 500 && env.isProd ? 'internal server error' : api.message,
        ...(api.details ? { details: api.details } : {}),
        ...(api.pg ? { pg: { code: api.pg.code, table: api.pg.table } } : {}),
      },
    });
  }
}
