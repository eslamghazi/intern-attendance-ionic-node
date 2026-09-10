var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { z } from 'zod';
import { FileCategory } from '../../../infrastructure/storage/file-manager.service.js';
export const categoryParamSchema = z.nativeEnum(FileCategory);
export const objectPathSchema = z
    .string()
    .min(1)
    .max(512)
    .refine((p) => !p.startsWith('/') && !p.split('/').includes('..'), 'invalid path');
export const uploadObjectSchema = z.object({
    path: objectPathSchema,
    content_base64: z.string().min(1),
    content_type: z.string().default('image/jpeg'),
});
export const getSignedUrlQuerySchema = z.object({
    path: objectPathSchema,
});
export const getSignedUrlsBodySchema = z.object({
    paths: z.array(objectPathSchema),
    expires_in: z.number().int().positive().optional(),
});
export const getObjectQuerySchema = z.object({
    path: objectPathSchema,
    expires: z.coerce.number().int().optional(),
    signature: z.string().optional(),
});
export const deleteObjectsBodySchema = z.object({
    paths: z.array(objectPathSchema),
});
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
export class UploadObjectDto {
    path;
    content_base64;
    content_type = 'image/jpeg';
}
__decorate([
    ApiProperty({ description: 'File path inside storage category bucket' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], UploadObjectDto.prototype, "path", void 0);
__decorate([
    ApiProperty({ description: 'Base64 encoded file payload' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], UploadObjectDto.prototype, "content_base64", void 0);
__decorate([
    ApiPropertyOptional({ description: 'MIME content type', default: 'image/jpeg' }),
    IsString(),
    IsOptional(),
    __metadata("design:type", String)
], UploadObjectDto.prototype, "content_type", void 0);
export class GetSignedUrlQueryDto {
    path;
}
__decorate([
    ApiProperty({ description: 'Relative path of file' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], GetSignedUrlQueryDto.prototype, "path", void 0);
export class GetSignedUrlsBodyDto {
    paths;
    expires_in;
}
__decorate([
    ApiProperty({ description: 'Array of relative file paths', type: [String] }),
    IsArray(),
    IsString({ each: true }),
    __metadata("design:type", Array)
], GetSignedUrlsBodyDto.prototype, "paths", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Expiration in seconds' }),
    Type(() => Number),
    IsNumber(),
    IsOptional(),
    __metadata("design:type", Number)
], GetSignedUrlsBodyDto.prototype, "expires_in", void 0);
export class DeleteObjectsBodyDto {
    paths;
}
__decorate([
    ApiProperty({ description: 'Array of relative file paths to delete', type: [String] }),
    IsArray(),
    IsString({ each: true }),
    __metadata("design:type", Array)
], DeleteObjectsBodyDto.prototype, "paths", void 0);
export class GetObjectQueryDto {
    path;
    expires;
    signature;
}
__decorate([
    ApiProperty({ description: 'Relative path of file' }),
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], GetObjectQueryDto.prototype, "path", void 0);
__decorate([
    ApiPropertyOptional({ description: 'URL expiration timestamp' }),
    Type(() => Number),
    IsNumber(),
    IsOptional(),
    __metadata("design:type", Number)
], GetObjectQueryDto.prototype, "expires", void 0);
__decorate([
    ApiPropertyOptional({ description: 'HMAC signature' }),
    IsString(),
    IsOptional(),
    __metadata("design:type", String)
], GetObjectQueryDto.prototype, "signature", void 0);
export class UploadObjectResponseDto {
    path;
    url;
}
__decorate([
    ApiProperty({ example: 'face/2026/09/image.jpg' }),
    __metadata("design:type", String)
], UploadObjectResponseDto.prototype, "path", void 0);
__decorate([
    ApiPropertyOptional({ example: 'https://cdn.example.com/face/image.jpg' }),
    __metadata("design:type", String)
], UploadObjectResponseDto.prototype, "url", void 0);
export class DeleteObjectsResponseDto {
    removed;
}
__decorate([
    ApiProperty({ example: 3 }),
    __metadata("design:type", Number)
], DeleteObjectsResponseDto.prototype, "removed", void 0);
//# sourceMappingURL=storage.dto.js.map