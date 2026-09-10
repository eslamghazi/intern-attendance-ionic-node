var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Catch, Injectable, Optional } from '@nestjs/common';
import { toApiError } from '../../http/errors.js';
import { env } from '../../env.js';
import { I18nService } from '../i18n/i18n.service.js';
let ApiExceptionFilter = class ApiExceptionFilter {
    i18n;
    constructor(i18n) {
        this.i18n = i18n;
        if (!this.i18n) {
            this.i18n = new I18nService();
        }
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const api = toApiError(exception);
        const lang = this.i18n?.resolveLanguage(request.headers) ?? 'ar';
        // SPA fallback: serve index.html for non-API, non-health frontend routes
        if (api.status === 404 &&
            !request.url.startsWith('/api') &&
            !request.url.startsWith('/health') &&
            typeof response.sendFile === 'function') {
            return response.sendFile('index.html');
        }
        if (api.status >= 500) {
            console.error(`[API 5xx] ${request.method} ${request.url}:`, exception);
        }
        const localizedAr = this.i18n?.translate(api.code, 'ar');
        const localizedEn = this.i18n?.translate(api.code, 'en');
        // Attendance refusals answer with their own `{ reason }` body, enhanced with bilingual descriptions
        if (api.payload) {
            const reasonCode = api.payload.reason || api.code;
            const refusalAr = this.i18n?.translate(reasonCode, 'ar');
            const refusalEn = this.i18n?.translate(reasonCode, 'en');
            return response.status(api.status).send({
                ...api.payload,
                message: lang === 'en' ? (refusalEn || api.message) : (refusalAr || api.message),
                message_ar: refusalAr,
            });
        }
        // Determine primary message based on requested language
        const primaryMessage = api.status >= 500 && env.isProd
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
};
ApiExceptionFilter = __decorate([
    Catch(),
    Injectable(),
    __param(0, Optional()),
    __metadata("design:paramtypes", [I18nService])
], ApiExceptionFilter);
export { ApiExceptionFilter };
//# sourceMappingURL=api-exception.filter.js.map