import { ExceptionFilter, Catch, ArgumentsHost, Injectable, Optional } from '@nestjs/common';
import { toApiError } from '../../http/errors.js';
import { env } from '../../env.js';
import { I18nService } from '../i18n/i18n.service.js';

@Catch()
@Injectable()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(@Optional() private readonly i18n?: I18nService) {
    if (!this.i18n) {
      this.i18n = new I18nService();
    }
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<any>();
    const request = ctx.getRequest<any>();

    const api = toApiError(exception);
    const lang = this.i18n?.resolveLanguage(request.headers) ?? 'ar';

    if (api.status >= 500) {
      console.error(`[API 5xx] ${request.method} ${request.url}:`, exception);
    }

    const localizedAr = this.i18n?.translate(api.code, 'ar');
    const localizedEn = this.i18n?.translate(api.code, 'en');

    // Attendance refusals answer with their own `{ reason }` body, enhanced with bilingual descriptions
    if (api.payload) {
      const reasonCode = (api.payload as any).reason || api.code;
      const refusalAr = this.i18n?.translate(reasonCode, 'ar');
      const refusalEn = this.i18n?.translate(reasonCode, 'en');

      return response.status(api.status).send({
        ...api.payload,
        message: lang === 'en' ? (refusalEn || api.message) : (refusalAr || api.message),
        message_ar: refusalAr,
      });
    }

    // Determine primary message based on requested language
    const primaryMessage =
      api.status >= 500 && env.isProd
        ? (lang === 'ar' ? 'حدث خطأ داخلي في الخادم، يرجى المحاولة لاحقاً' : 'internal server error')
        : (lang === 'en' ? (localizedEn || api.message) : (localizedAr || api.message));

    return response.status(api.status).send({
      ok: false,
      error: {
        code: api.code,
        message: primaryMessage,
        message_ar: localizedAr,
        ...(api.details ? { details: api.details } : {}),
        ...(api.pg ? { pg: { code: api.pg.code, table: api.pg.table } } : {}),
      },
    });
  }
}
