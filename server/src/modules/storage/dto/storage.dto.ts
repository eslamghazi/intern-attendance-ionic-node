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
