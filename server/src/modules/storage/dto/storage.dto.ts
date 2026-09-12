import { z } from 'zod';
import { FILE_KIND_NAMES, type FileKind } from '../../../config/constants.js';

/** The `:kind` path segment. Rejects anything that is not a declared kind. */
export const kindParamSchema = z.enum(FILE_KIND_NAMES as [FileKind, ...FileKind[]]);

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
  @ApiProperty({ description: 'Path within the file kind' })
  @IsString()
  @IsNotEmpty()
  path!: string;

  @ApiProperty({ description: 'Base64 encoded file payload' })
  @IsString()
  @IsNotEmpty()
  content_base64!: string;

  @ApiPropertyOptional({ description: 'MIME content type', default: 'image/jpeg' })
  @IsString()
  @IsOptional()
  content_type?: string = 'image/jpeg';
}

export class GetSignedUrlQueryDto {
  @ApiProperty({ description: 'Relative path of file' })
  @IsString()
  @IsNotEmpty()
  path!: string;
}

export class GetSignedUrlsBodyDto {
  @ApiProperty({ description: 'Array of relative file paths', type: [String] })
  @IsArray()
  @IsString({ each: true })
  paths!: string[];

  @ApiPropertyOptional({ description: 'Expiration in seconds' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  expires_in?: number;
}

export class DeleteObjectsBodyDto {
  @ApiProperty({ description: 'Array of relative file paths to delete', type: [String] })
  @IsArray()
  @IsString({ each: true })
  paths!: string[];
}

export class GetObjectQueryDto {
  @ApiProperty({ description: 'Relative path of file' })
  @IsString()
  @IsNotEmpty()
  path!: string;

  @ApiPropertyOptional({ description: 'URL expiration timestamp' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  expires?: number;

  @ApiPropertyOptional({ description: 'HMAC signature' })
  @IsString()
  @IsOptional()
  signature?: string;
}

export class UploadObjectResponseDto {
  @ApiProperty({ example: 'face/2026/09/image.jpg' })
  path!: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/face/image.jpg' })
  url?: string;
}

export class DeleteObjectsResponseDto {
  @ApiProperty({ example: 3 })
  removed!: number;
}

