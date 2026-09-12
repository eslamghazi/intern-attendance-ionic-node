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
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
export class UpdateProfileDto {
    full_name;
    phone;
    email;
    national_id;
    avatar_url;
}
__decorate([
    ApiProperty({ example: 'Dr. Sarah Connor' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "full_name", void 0);
__decorate([
    ApiPropertyOptional({ example: '+201001234567' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], UpdateProfileDto.prototype, "phone", void 0);
__decorate([
    ApiPropertyOptional({ example: 'sarah@example.com' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], UpdateProfileDto.prototype, "email", void 0);
__decorate([
    ApiProperty({ example: '29001011234567' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "national_id", void 0);
__decorate([
    ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' }),
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], UpdateProfileDto.prototype, "avatar_url", void 0);
export class MemberCodeResponseDto {
    code;
}
__decorate([
    ApiPropertyOptional({ example: '1042' }),
    __metadata("design:type", Object)
], MemberCodeResponseDto.prototype, "code", void 0);
export class ProfileResponseDto {
    id;
    full_name;
    national_id;
    phone;
    email;
    avatar_url;
}
__decorate([
    ApiProperty({ example: 'p1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], ProfileResponseDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'Dr. Sarah Connor' }),
    __metadata("design:type", String)
], ProfileResponseDto.prototype, "full_name", void 0);
__decorate([
    ApiProperty({ example: '29001011234567' }),
    __metadata("design:type", String)
], ProfileResponseDto.prototype, "national_id", void 0);
__decorate([
    ApiPropertyOptional({ example: '+201001234567' }),
    __metadata("design:type", Object)
], ProfileResponseDto.prototype, "phone", void 0);
__decorate([
    ApiPropertyOptional({ example: 'sarah@example.com' }),
    __metadata("design:type", Object)
], ProfileResponseDto.prototype, "email", void 0);
__decorate([
    ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' }),
    __metadata("design:type", Object)
], ProfileResponseDto.prototype, "avatar_url", void 0);
//# sourceMappingURL=profile.dto.js.map