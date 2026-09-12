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
import { toApiError } from '../errors.js';
import { env } from '../../config/env.js';
import { I18nService } from '../i18n/i18n.service.js';
import { AuditService } from '../../modules/audit/audit.service.js';
import { AuditEvent } from '../enums/index.js';
let ApiExceptionFilter = class ApiExceptionFilter {
    i18n;
    audit;
    constructor(i18n, audit) {
        this.i18n = i18n;
        this.audit = audit;
        if (!this.i18n) {
            this.i18n = new I18nService();
        }
    }
    /**
     * Put a server failure in the audit trail, beside the refusals.
     *
     * ONLY 5xx. A 4xx is the caller being told they got something wrong, which is
     * the system working — recording those would bury the trail under validation
     * noise and make it useless for the thing it exists for.
     *
     * WHAT IS RECORDED, AND WHAT IS NOT
     *
     * Method, path, status, error code and the Postgres SQLSTATE when there is
     * one. NOT the stack trace, NOT the query, NOT the request body: this table
     * is readable by every admin through GET /api/v1/audit, and a stack trace is
     * where connection strings and other people's data end up. The full detail
     * stays in the process log, which only an operator can read.
     *
     * The query string is dropped for the same reason — it carries national ids
     * and filters that name people.
     *
     * Deliberately not awaited. The response must not wait on a log write, and a
     * failure to record must not turn a 500 into a hang. It runs in its own
     * transaction, which matters here: the request's transaction has already
     * rolled back by the time this runs, and a record written inside it would
     * roll back with it — the exact case where the trail is most wanted.
     */
    recordFailure(request, api, exception) {
        if (!this.audit)
            return;
        const actorId = request.caller?.id ?? request.raw.caller?.id ?? null;
        // `?? ''` because split() is typed as possibly-empty, and an audit detail
        // must be JSON — `undefined` is the one thing JSON cannot carry.
        const path = request.url.split('?')[0] ?? '';
        void this.audit
            .record(actorId, AuditEvent.SERVER_ERROR, {
            method: request.method,
            path,
            status: api.status,
            code: api.code,
            pg_code: api.pg?.code ?? null,
            // The class name, not the message: a message can carry interpolated
            // data, a constructor name cannot.
            kind: exception instanceof Error ? exception.constructor.name : typeof exception,
        })
            .catch(() => {
            // Already logged above; an audit failure must not mask the original.
        });
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
            this.recordFailure(request, api, exception);
        }
        const localizedAr = this.i18n?.translate(api.code, 'ar');
        const localizedEn = this.i18n?.translate(api.code, 'en');
        // Attendance refusals answer with their own `{ reason }` body, enhanced with bilingual descriptions
        if (api.payload) {
            // The refusal's own reason when it has one — see ApiError.payload. It is
            // JSON off a domain refusal, so it is read as a string rather than assumed
            // to be one.
            const reason = api.payload.reason;
            const reasonCode = typeof reason === 'string' && reason ? reason : api.code;
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
    __param(1, Optional()),
    __metadata("design:paramtypes", [I18nService,
        AuditService])
], ApiExceptionFilter);
export { ApiExceptionFilter };
//# sourceMappingURL=api-exception.filter.js.map