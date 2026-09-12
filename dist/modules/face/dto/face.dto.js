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
import { IsString, IsNotEmpty, IsUUID, IsArray, IsOptional, IsNumber } from 'class-validator';
export class EnrollPhotoDto {
    image_base64;
}
__decorate([
    ApiProperty({ description: 'Base64 encoded JPEG image data' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], EnrollPhotoDto.prototype, "image_base64", void 0);
export class ResetFaceDto {
    member_id;
}
__decorate([
    ApiProperty({ description: 'Target member UUID' }),
    IsUUID(),
    IsNotEmpty(),
    __metadata("design:type", String)
], ResetFaceDto.prototype, "member_id", void 0);
export class LookupFaceDto {
    code;
}
__decorate([
    ApiProperty({ description: 'Member numeric or alphanumeric code' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], LookupFaceDto.prototype, "code", void 0);
export class PutTemplateDto {
    embedding;
    photo_path;
    quality_score;
}
__decorate([
    ApiProperty({ description: '512-dimension embedding vector as string format "[0.12, ...]"]' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], PutTemplateDto.prototype, "embedding", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Photo storage relative path', nullable: true }),
    IsString(),
    IsOptional(),
    __metadata("design:type", Object)
], PutTemplateDto.prototype, "photo_path", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Quality assessment score', nullable: true }),
    IsNumber(),
    IsOptional(),
    __metadata("design:type", Object)
], PutTemplateDto.prototype, "quality_score", void 0);
export class GetTemplatePhotosDto {
    member_ids;
}
__decorate([
    ApiProperty({ description: 'List of member UUIDs', type: [String] }),
    IsArray(),
    IsUUID('4', { each: true }),
    __metadata("design:type", Array)
], GetTemplatePhotosDto.prototype, "member_ids", void 0);
export class ToolResetDto {
    member_id;
}
__decorate([
    ApiProperty({ description: 'Target member UUID' }),
    IsUUID(),
    IsNotEmpty(),
    __metadata("design:type", String)
], ToolResetDto.prototype, "member_id", void 0);
export class LookupFaceResponseDto {
    found;
    member_id;
    member_code;
    full_name;
    enrolled;
}
__decorate([
    ApiProperty({ description: 'Whether the member code was found' }),
    __metadata("design:type", Boolean)
], LookupFaceResponseDto.prototype, "found", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Member UUID' }),
    __metadata("design:type", String)
], LookupFaceResponseDto.prototype, "member_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Member numeric code' }),
    __metadata("design:type", Object)
], LookupFaceResponseDto.prototype, "member_code", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Full name' }),
    __metadata("design:type", String)
], LookupFaceResponseDto.prototype, "full_name", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Whether the member has a face biometric enrolled' }),
    __metadata("design:type", Boolean)
], LookupFaceResponseDto.prototype, "enrolled", void 0);
export class TemplateResponseDto {
    // Numbers, never a string. The column is `real[]` and the driver hands it
    // back as number[]; the `| string` this used to allow described the pgvector
    // column it replaced, which came back as the text '[0.1,0.2,…]'.
    embedding;
}
__decorate([
    ApiPropertyOptional({ description: 'Embedding vector, or null when not enrolled', nullable: true }),
    __metadata("design:type", Object)
], TemplateResponseDto.prototype, "embedding", void 0);
export class TemplatePhotoItemDto {
    member_id;
    photo_path;
    created_at;
}
__decorate([
    ApiProperty({ description: 'Member UUID' }),
    __metadata("design:type", String)
], TemplatePhotoItemDto.prototype, "member_id", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Stored photo path', nullable: true }),
    __metadata("design:type", Object)
], TemplatePhotoItemDto.prototype, "photo_path", void 0);
__decorate([
    ApiProperty({ description: 'Creation date' }),
    __metadata("design:type", Date)
], TemplatePhotoItemDto.prototype, "created_at", void 0);
//# sourceMappingURL=face.dto.js.map