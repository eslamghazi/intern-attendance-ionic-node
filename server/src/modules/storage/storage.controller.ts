import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Public } from '../../common/decorators/public.decorator.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import type { JwtClaims } from '../../db/context.js';
import { ApiError, badRequest, notFound } from '../../http/errors.js';
import { FileManager } from '../../infrastructure/storage/file-manager.service.js';
import { StorageService } from './storage.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import {
  categoryParamSchema,
  uploadObjectSchema,
  getSignedUrlQuerySchema,
  getSignedUrlsBodySchema,
  getObjectQuerySchema,
  deleteObjectsBodySchema,
} from './dto/storage.dto.js';
import { Role } from '../../common/enums/index.js';

@Controller('api/v1/storage')
export class StorageController {
  constructor(
    private readonly service: StorageService,
    private readonly fileManager: FileManager,
  ) {}

  @Post(':category')
  async uploadObject(
    @CallerDecorator() caller: Caller | null,
    @ClaimsDecorator() claims: JwtClaims,
    @Param('category') categoryRaw: string,
    @Body() body: unknown,
  ) {
    const params = categoryParamSchema.safeParse(categoryRaw);
    const parsedBody = uploadObjectSchema.safeParse(body);
    if (!params.success || !parsedBody.success) throw badRequest('invalid_request', 'invalid upload');

    const bytes = this.fileManager.decodeBase64Image(parsedBody.data.content_base64);
    if (!bytes) throw badRequest('bad_base64', 'could not decode the payload');

    const data = await this.service.uploadObject(
      caller!,
      claims,
      params.data,
      parsedBody.data.path,
      bytes,
      parsedBody.data.content_type,
    );
    return new ApiResponse(data);
  }

  @Public()
  @Get(':category/url')
  async getSignedUrl(
    @ClaimsDecorator() claims: JwtClaims | null,
    @Param('category') categoryRaw: string,
    @Query() queryParams: unknown,
  ) {
    const params = categoryParamSchema.safeParse(categoryRaw);
    const parsedQuery = getSignedUrlQuerySchema.safeParse(queryParams);
    if (!params.success || !parsedQuery.success) throw badRequest('invalid_request', 'invalid request');
    const url = await this.fileManager.getSignedUrl(claims, params.data, parsedQuery.data.path);
    return new ApiResponse({ url });
  }

  @Public()
  @Post(':category/urls')
  async getSignedUrls(
    @ClaimsDecorator() claims: JwtClaims | null,
    @Param('category') categoryRaw: string,
    @Body() body: unknown,
  ) {
    const params = categoryParamSchema.safeParse(categoryRaw);
    const parsedBody = getSignedUrlsBodySchema.safeParse(body);
    if (!params.success || !parsedBody.success) throw badRequest('invalid_request', 'invalid request');

    const data = await this.fileManager.getSignedUrls(
      claims,
      params.data,
      parsedBody.data.paths,
      parsedBody.data.expires_in,
    );
    return new ApiResponse(data);
  }

  @Public()
  @Get(':category/object')
  async getObject(
    @Param('category') categoryRaw: string,
    @Query() queryParams: unknown,
    @Res() res: FastifyReply,
  ) {

    const params = categoryParamSchema.safeParse(categoryRaw);
    const parsedQuery = getObjectQuerySchema.safeParse(queryParams);
    if (!params.success || !parsedQuery.success) throw notFound('object not found');

    const category = params.data;
    const { path, expires, signature } = parsedQuery.data;

    if (!this.fileManager.isPublic(category)) {
      if (expires === undefined || !signature) throw notFound('object not found');
      const result = this.fileManager.verifySignature(category, path, expires, signature);
      if (result === 'expired') {
        throw new ApiError(410, 'url_expired', 'this link has expired');
      }
      if (result !== 'ok') throw notFound('object not found');
    }

    const object = await this.fileManager.download(category, path);
    const isPublic = this.fileManager.isPublic(category);

    if (typeof (res as any).header === 'function') {
      (res as any)
        .header('content-type', object.contentType)
        .header('content-length', object.size)
        .header('content-disposition', 'inline')
        .header('cache-control', isPublic ? 'public, max-age=300' : 'private, no-store');
      return (res as any).send(object.stream);
    }

    (res as any).setHeader('content-type', object.contentType);
    (res as any).setHeader('content-length', object.size);
    (res as any).setHeader('content-disposition', 'inline');
    (res as any).setHeader('cache-control', isPublic ? 'public, max-age=300' : 'private, no-store');
    object.stream.pipe(res as any);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Delete(':category')
  async deleteObjects(
    @Param('category') categoryRaw: string,
    @Body() body: unknown,
  ) {
    const params = categoryParamSchema.safeParse(categoryRaw);
    const parsedBody = deleteObjectsBodySchema.safeParse(body);
    if (!params.success || !parsedBody.success) throw badRequest('invalid_request', 'invalid request');

    const paths = [...new Set(parsedBody.data.paths.filter(Boolean))];
    if (!paths.length) return new ApiResponse({ removed: 0 });

    await this.service.deleteObjects(params.data, paths);

    return new ApiResponse({ removed: paths.length });
  }
}
