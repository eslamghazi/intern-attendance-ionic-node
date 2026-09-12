var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class ApiResponse {
    ok;
    data;
    message;
    message_ar;
    meta;
    constructor(data, meta, messages) {
        this.ok = true;
        this.data = data;
        this.meta = meta;
        if (messages?.message)
            this.message = messages.message;
        if (messages?.message_ar)
            this.message_ar = messages.message_ar;
    }
}
__decorate([
    ApiProperty({ example: true }),
    __metadata("design:type", Boolean)
], ApiResponse.prototype, "ok", void 0);
__decorate([
    ApiProperty({ description: 'Payload data' }),
    __metadata("design:type", Object)
], ApiResponse.prototype, "data", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Human-readable response message in English or resolved language' }),
    __metadata("design:type", String)
], ApiResponse.prototype, "message", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Human-readable response message in Arabic' }),
    __metadata("design:type", String)
], ApiResponse.prototype, "message_ar", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Optional metadata' }),
    __metadata("design:type", Object)
], ApiResponse.prototype, "meta", void 0);
export class PaginatedResponse {
    ok;
    data;
    total;
    message;
    message_ar;
    meta;
    constructor(data, total, meta, messages) {
        this.ok = true;
        this.data = data;
        this.total = total;
        this.meta = meta;
        if (messages?.message)
            this.message = messages.message;
        if (messages?.message_ar)
            this.message_ar = messages.message_ar;
    }
}
__decorate([
    ApiProperty({ example: true }),
    __metadata("design:type", Boolean)
], PaginatedResponse.prototype, "ok", void 0);
__decorate([
    ApiProperty({ description: 'List of items', isArray: true }),
    __metadata("design:type", Array)
], PaginatedResponse.prototype, "data", void 0);
__decorate([
    ApiProperty({ example: 100, description: 'Total item count across all pages' }),
    __metadata("design:type", Number)
], PaginatedResponse.prototype, "total", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Human-readable response message in English or resolved language' }),
    __metadata("design:type", String)
], PaginatedResponse.prototype, "message", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Human-readable response message in Arabic' }),
    __metadata("design:type", String)
], PaginatedResponse.prototype, "message_ar", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Optional pagination metadata' }),
    __metadata("design:type", Object)
], PaginatedResponse.prototype, "meta", void 0);
export class ApiErrorDetail {
    code;
    message;
    message_ar;
    details;
    pg;
    constructor(code = 'internal_error', message = 'Internal error', details, pg, message_ar) {
        this.code = code;
        this.message = message;
        this.details = details;
        this.pg = pg;
        this.message_ar = message_ar;
    }
}
__decorate([
    ApiProperty({ example: 'bad_request', description: 'Machine-readable error code' }),
    __metadata("design:type", String)
], ApiErrorDetail.prototype, "code", void 0);
__decorate([
    ApiProperty({ example: 'Invalid input parameters', description: 'Human-readable error description in English or resolved language' }),
    __metadata("design:type", String)
], ApiErrorDetail.prototype, "message", void 0);
__decorate([
    ApiPropertyOptional({ example: 'بيانات الطلب غير صالحة', description: 'Human-readable error description in Arabic' }),
    __metadata("design:type", String)
], ApiErrorDetail.prototype, "message_ar", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Detailed validation or domain errors' }),
    __metadata("design:type", Object)
], ApiErrorDetail.prototype, "details", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Postgres SQL state and table info if applicable' }),
    __metadata("design:type", Object)
], ApiErrorDetail.prototype, "pg", void 0);
export class ApiErrorResponse {
    ok;
    error;
    constructor(arg1, arg2, details, pg, message_ar) {
        this.ok = false;
        if (typeof arg1 === 'string') {
            this.error = new ApiErrorDetail(arg1, arg2 || '', details, pg, message_ar);
        }
        else {
            this.error = arg1;
        }
    }
}
__decorate([
    ApiProperty({ example: false }),
    __metadata("design:type", Boolean)
], ApiErrorResponse.prototype, "ok", void 0);
__decorate([
    ApiProperty({ type: ApiErrorDetail }),
    __metadata("design:type", ApiErrorDetail)
], ApiErrorResponse.prototype, "error", void 0);
//# sourceMappingURL=api-response.dto.js.map