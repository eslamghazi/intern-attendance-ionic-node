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
import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
export class MintQrDto {
    branch_id;
    date;
    member_id;
}
__decorate([
    ApiPropertyOptional({ description: 'Branch UUID (optional for members with branch assigned)' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", String)
], MintQrDto.prototype, "branch_id", void 0);
__decorate([
    ApiProperty({ description: 'Target date (YYYY-MM-DD)', example: '2026-09-10' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], MintQrDto.prototype, "date", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Optional specific member UUID for member-bound QR' }),
    IsUUID(),
    IsOptional(),
    __metadata("design:type", Object)
], MintQrDto.prototype, "member_id", void 0);
export class RedeemQrDto {
    token;
}
__decorate([
    ApiProperty({ description: 'QR token code' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], RedeemQrDto.prototype, "token", void 0);
export class MintQrResponseDto {
    ok;
    token;
    date;
    validity_seconds;
}
__decorate([
    ApiProperty({ example: true }),
    __metadata("design:type", Boolean)
], MintQrResponseDto.prototype, "ok", void 0);
__decorate([
    ApiProperty({ description: 'Minted QR token string' }),
    __metadata("design:type", String)
], MintQrResponseDto.prototype, "token", void 0);
__decorate([
    ApiProperty({ description: 'Active date' }),
    __metadata("design:type", String)
], MintQrResponseDto.prototype, "date", void 0);
__decorate([
    ApiProperty({ description: 'Validity duration in seconds' }),
    __metadata("design:type", Number)
], MintQrResponseDto.prototype, "validity_seconds", void 0);
export class RedeemQrResponseDto {
    ok;
    until;
    minutes;
}
__decorate([
    ApiProperty({ example: true }),
    __metadata("design:type", Boolean)
], RedeemQrResponseDto.prototype, "ok", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Timestamp until which GPS location checks are bypassed' }),
    __metadata("design:type", Object)
], RedeemQrResponseDto.prototype, "until", void 0);
__decorate([
    ApiProperty({ description: 'Bypass duration granted in minutes' }),
    __metadata("design:type", Number)
], RedeemQrResponseDto.prototype, "minutes", void 0);
//# sourceMappingURL=qr.dto.js.map