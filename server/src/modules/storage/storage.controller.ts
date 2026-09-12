import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Public } from '../../common/decorators/public.decorator.js';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import type { JwtClaims } from '../../infrastructure/database/context.js';
import { ApiError, badRequest, notFound } from '../../common/errors.js';
import { FileManager } from '../../infrastructure/storage/file-manager.service.js';
import { StorageService } from './storage.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import {
  kindParamSchema,
  UploadObjectDto,
  GetSignedUrlQueryDto,
  GetSignedUrlsBodyDto,
  GetObjectQueryDto,
  DeleteObjectsBodyDto,
  UploadObjectResponseDto,
  DeleteObjectsResponseDto,
} from './dto/storage.dto.js';
import { Role } from '../../common/enums/index.js';

@Controller('api/v1/storage')
export class StorageController {
  constructor(
    private readonly service: StorageService,
    private readonly fileManager: FileManager,
  ) {}

  @Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN)
  @Post(':kind')
  async uploadObject(
    @CallerDecorator() caller: Caller | null,
    @ClaimsDecorator() claims: JwtClaims,
    @Param('kind') kindRaw: string,
    @Body() body: UploadObjectDto,
  ): Promise<ApiResponse<UploadObjectResponseDto>> {
    const params = kindParamSchema.safeParse(kindRaw);
    if (!params.success) throw badRequest('invalid_request', 'invalid kind');

    const bytes = this.fileManager.decodeBase64Image(body.content_base64);
    if (!bytes) throw badRequest('bad_base64', 'could not decode the payload');

    const data = await this.service.uploadObject(
      caller!,
      claims,
      params.data,
      body.path,
      bytes,
      body.content_type || 'image/jpeg',
    );
    return new ApiResponse(data);
  }

  @Public()
  @Get(':kind/url')
  async getSignedUrl(
    @ClaimsDecorator() claims: JwtClaims | null,
    @Param('kind') kindRaw: string,
    @Query() queryParams: GetSignedUrlQueryDto,
  ): Promise<ApiResponse<{ url: string }>> {
    const params = kindParamSchema.safeParse(kindRaw);
    if (!params.success) throw badRequest('invalid_request', 'invalid kind');
    const url = await this.fileManager.getSignedUrl(claims, params.data, queryParams.path);
    return new ApiResponse({ url });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post(':kind/urls')
  async getSignedUrls(
    @ClaimsDecorator() claims: JwtClaims | null,
    @Param('kind') kindRaw: string,
    @Body() body: GetSignedUrlsBodyDto,
  ): Promise<ApiResponse<Record<string, string>>> {
    const params = kindParamSchema.safeParse(kindRaw);
    if (!params.success) throw badRequest('invalid_request', 'invalid kind');

    const data = await this.fileManager.getSignedUrls(
      claims,
      params.data,
      body.paths,
      body.expires_in,
    );
    return new ApiResponse(data);
  }

  @Public()
  @Get(':kind/object')
  async getObject(
    @Param('kind') kindRaw: string,
    @Query() queryParams: GetObjectQueryDto,
    @Res() res: FastifyReply,
  ) {
    const params = kindParamSchema.safeParse(kindRaw);
    if (!params.success) throw notFound('object not found');

    const kind = params.data;
    const { path, expires, signature } = queryParams;

    if (!this.fileManager.isPubliclyReadable(kind)) {
      if (expires === undefined || !signature) throw notFound('object not found');
      const result = this.fileManager.verifySignature(kind, path, expires, signature);
      if (result === 'expired') {
        throw new ApiError(410, 'url_expired', 'this link has expired');
      }
      if (result !== 'ok') throw notFound('object not found');
    }

    const object = await this.fileManager.download(kind, path);
    const isPublic = this.fileManager.isPubliclyReadable(kind);

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
  @Delete(':kind')
  async deleteObjects(
    @Param('kind') kindRaw: string,
    @Body() body: DeleteObjectsBodyDto,
  ): Promise<ApiResponse<DeleteObjectsResponseDto>> {
    const params = kindParamSchema.safeParse(kindRaw);
    if (!params.success) throw badRequest('invalid_request', 'invalid kind');

    const paths = [...new Set((body.paths || []).filter(Boolean))];
    if (!paths.length) return new ApiResponse({ removed: 0 });

    await this.service.deleteObjects(params.data, paths);

    return new ApiResponse({ removed: paths.length });
  }
}
