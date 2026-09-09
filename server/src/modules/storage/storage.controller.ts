import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { faceTemplates, attendance } from '../../db/schema/index.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import type { JwtClaims } from '../../db/context.js';
import {
  BUCKETS,
  isPublicBucket,
  openObject,
  signedUrl,
  signedUrls,
  putObject,
  removeObjects,
  type Bucket,
} from '../../storage/objects.js';
import { verify } from '../../storage/signing.js';
import { arrayOf, asService } from '../../db/context.js';
import { ApiError, badRequest, notFound } from '../../http/errors.js';

const bucketParam = z.enum([BUCKETS.faces, BUCKETS.probes, BUCKETS.avatars]);

const objectPath = z
  .string()
  .min(1)
  .max(512)
  .refine((p) => !p.startsWith('/') && !p.split('/').includes('..'), 'invalid path');

import { StorageService } from './storage.service.js';

@Controller('api/v1/storage')
export class StorageController {
  constructor(private readonly service: StorageService) {}

  @Post(':bucket')
  @HttpCode(HttpStatus.CREATED)
  async uploadObject(
    @CallerDecorator() caller: Caller,
    @ClaimsDecorator() claims: JwtClaims,
    @Param('bucket') bucketRaw: string,
    @Body() body: unknown,
  ) {
    const params = z.object({ bucket: bucketParam }).safeParse({ bucket: bucketRaw });
    const parsedBody = z
      .object({
        path: objectPath,
        content_base64: z.string().min(1),
        content_type: z.string().default('image/jpeg'),
      })
      .safeParse(body);
    if (!params.success || !parsedBody.success) throw badRequest('invalid', 'invalid upload');

    const bytes = Buffer.from(parsedBody.data.content_base64.split(',').pop() ?? '', 'base64');
    if (!bytes.length) throw badRequest('bad_base64', 'could not decode the payload');

    return this.service.uploadObject(
      caller,
      claims,
      params.data.bucket as Bucket,
      parsedBody.data.path,
      bytes,
      parsedBody.data.content_type,
    );
  }

  @Public()
  @Get(':bucket/url')
  async getSignedUrl(
    @ClaimsDecorator() claims: JwtClaims | null,
    @Param('bucket') bucketRaw: string,
    @Query() queryParams: unknown,
  ) {
    const params = z.object({ bucket: bucketParam }).safeParse({ bucket: bucketRaw });
    const parsedQuery = z.object({ path: objectPath }).safeParse(queryParams);
    if (!params.success || !parsedQuery.success) throw badRequest('invalid', 'invalid request');
    return {
      url: await signedUrl(claims, params.data.bucket as Bucket, parsedQuery.data.path),
    };
  }

  @Public()
  @Post(':bucket/urls')
  async getSignedUrls(
    @ClaimsDecorator() claims: JwtClaims | null,
    @Param('bucket') bucketRaw: string,
    @Body() body: unknown,
  ) {
    const params = z.object({ bucket: bucketParam }).safeParse({ bucket: bucketRaw });
    const parsedBody = z
      .object({ paths: z.array(objectPath), expires_in: z.number().int().positive().optional() })
      .safeParse(body);
    if (!params.success || !parsedBody.success) throw badRequest('invalid', 'invalid request');

    return signedUrls(
      claims,
      params.data.bucket as Bucket,
      parsedBody.data.paths,
      parsedBody.data.expires_in,
    );
  }

  @Public()
  @Get(':bucket/object')
  async getObject(
    @Param('bucket') bucketRaw: string,
    @Query() queryParams: unknown,
    @Res() res: Response,
  ) {
    const params = z.object({ bucket: bucketParam }).safeParse({ bucket: bucketRaw });
    const parsedQuery = z
      .object({
        path: objectPath,
        expires: z.coerce.number().int().optional(),
        signature: z.string().optional(),
      })
      .safeParse(queryParams);
    if (!params.success || !parsedQuery.success) throw notFound('object not found');

    const bucket = params.data.bucket as Bucket;
    const { path, expires, signature } = parsedQuery.data;

    if (!isPublicBucket(bucket)) {
      if (expires === undefined || !signature) throw notFound('object not found');
      const result = verify(bucket, path, expires, signature);
      if (result === 'expired') {
        throw new ApiError(410, 'url_expired', 'this link has expired');
      }
      if (result !== 'ok') throw notFound('object not found');
    }

    const object = await openObject(bucket, path);
    res.setHeader('content-type', object.contentType);
    res.setHeader('content-length', object.size);
    res.setHeader('content-disposition', 'inline');
    res.setHeader(
      'cache-control',
      isPublicBucket(bucket) ? 'public, max-age=300' : 'private, no-store',
    );
    object.stream.pipe(res);
  }

  @Roles('admin', 'superadmin')
  @Delete(':bucket')
  async deleteObjects(
    @Param('bucket') bucketRaw: string,
    @Body() body: unknown,
  ) {
    const params = z.object({ bucket: bucketParam }).safeParse({ bucket: bucketRaw });
    const parsedBody = z.object({ paths: z.array(objectPath) }).safeParse(body);
    if (!params.success || !parsedBody.success) throw badRequest('invalid', 'invalid request');

    const paths = [...new Set(parsedBody.data.paths.filter(Boolean))];
    if (!paths.length) return { removed: 0 };

    await this.service.deleteObjects(params.data.bucket as Bucket, paths);

    return { removed: paths.length };
  }
}
