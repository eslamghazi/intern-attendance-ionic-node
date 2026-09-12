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
import { IsBoolean, IsDefined, IsOptional } from 'class-validator';
/** One superadmin, as the page lists them. Never carries a hash. */
export class SuperadminAccountDto {
    id;
    full_name;
    national_id;
    phone;
    email;
    is_active;
    created_at;
}
__decorate([
    ApiProperty({ example: 'a1d0e513-5b8b-4c74-8b6b-1a5ec4c74000' }),
    __metadata("design:type", String)
], SuperadminAccountDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ example: 'Super Admin' }),
    __metadata("design:type", String)
], SuperadminAccountDto.prototype, "full_name", void 0);
__decorate([
    ApiProperty({ example: '30110281500753' }),
    __metadata("design:type", String)
], SuperadminAccountDto.prototype, "national_id", void 0);
__decorate([
    ApiPropertyOptional({ example: '+201001234567' }),
    __metadata("design:type", Object)
], SuperadminAccountDto.prototype, "phone", void 0);
__decorate([
    ApiPropertyOptional({ example: 'admin@example.com' }),
    __metadata("design:type", Object)
], SuperadminAccountDto.prototype, "email", void 0);
__decorate([
    ApiProperty({ example: true }),
    __metadata("design:type", Boolean)
], SuperadminAccountDto.prototype, "is_active", void 0);
__decorate([
    ApiProperty({ example: '2026-09-12T05:11:55.000Z' }),
    __metadata("design:type", String)
], SuperadminAccountDto.prototype, "created_at", void 0);
export class RestoreSuperadminDto {
    /**
     * The backup file's contents, verbatim.
     *
     * `JsonValue` rather than a shape: this came out of a file the caller chose,
     * and deciding whether it is a backup of ours is the job of
     * parseSuperadminBackup — which says WHICH account is wrong, where a DTO
     * validator would only say the body is invalid.
     */
    file;
    overwrite;
}
__decorate([
    ApiProperty({ description: 'The parsed contents of a backup file' }),
    IsDefined(),
    __metadata("design:type", Object)
], RestoreSuperadminDto.prototype, "file", void 0);
__decorate([
    ApiPropertyOptional({
        description: 'Replace accounts that already exist. Without it they are skipped.',
        default: false,
    }),
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], RestoreSuperadminDto.prototype, "overwrite", void 0);
export class RestoreResultDto {
    added;
    overwritten;
    skipped;
    accounts;
}
__decorate([
    ApiProperty({ example: 1 }),
    __metadata("design:type", Number)
], RestoreResultDto.prototype, "added", void 0);
__decorate([
    ApiProperty({ example: 0 }),
    __metadata("design:type", Number)
], RestoreResultDto.prototype, "overwritten", void 0);
__decorate([
    ApiProperty({ example: 0 }),
    __metadata("design:type", Number)
], RestoreResultDto.prototype, "skipped", void 0);
__decorate([
    ApiProperty({ description: 'What happened to each account in the file' }),
    __metadata("design:type", Array)
], RestoreResultDto.prototype, "accounts", void 0);
//# sourceMappingURL=superadmin.dto.js.map