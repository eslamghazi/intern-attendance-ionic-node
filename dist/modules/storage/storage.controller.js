var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Res } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AnyStaff, Page } from '../../common/decorators/page.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import { ApiError, badRequest, notFound } from '../../common/errors.js';
import { FileManager } from '../../infrastructure/storage/file-manager.service.js';
import { StorageService } from './storage.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { kindParamSchema, UploadObjectDto, GetSignedUrlQueryDto, GetSignedUrlsBodyDto, GetObjectQueryDto, DeleteObjectsBodyDto, } from './dto/storage.dto.js';
import { Role } from '../../common/enums/index.js';
let StorageController = class StorageController {
    service;
    fileManager;
    constructor(service, fileManager) {
        this.service = service;
        this.fileManager = fileManager;
    }
    async uploadObject(caller, claims, kindRaw, body) {
        const params = kindParamSchema.safeParse(kindRaw);
        if (!params.success)
            throw badRequest('invalid_request', 'invalid kind');
        const bytes = this.fileManager.decodeBase64Image(body.content_base64);
        if (!bytes)
            throw badRequest('bad_base64', 'could not decode the payload');
        const data = await this.service.uploadObject(caller, claims, params.data, body.path, bytes, body.content_type || 'image/jpeg');
        return new ApiResponse(data);
    }
    async getSignedUrl(claims, kindRaw, queryParams) {
        const params = kindParamSchema.safeParse(kindRaw);
        if (!params.success)
            throw badRequest('invalid_request', 'invalid kind');
        const url = await this.fileManager.getSignedUrl(claims, params.data, queryParams.path);
        return new ApiResponse({ url });
    }
    async getSignedUrls(claims, kindRaw, body) {
        const params = kindParamSchema.safeParse(kindRaw);
        if (!params.success)
            throw badRequest('invalid_request', 'invalid kind');
        const data = await this.fileManager.getSignedUrls(claims, params.data, body.paths, body.expires_in);
        return new ApiResponse(data);
    }
    async getObject(kindRaw, queryParams, res) {
        const params = kindParamSchema.safeParse(kindRaw);
        if (!params.success)
            throw notFound('object not found');
        const kind = params.data;
        const { path, expires, signature } = queryParams;
        if (!this.fileManager.isPubliclyReadable(kind)) {
            if (expires === undefined || !signature)
                throw notFound('object not found');
            const result = this.fileManager.verifySignature(kind, path, expires, signature);
            if (result === 'expired') {
                throw new ApiError(410, 'url_expired', 'this link has expired');
            }
            if (result !== 'ok')
                throw notFound('object not found');
        }
        const object = await this.fileManager.download(kind, path);
        const isPublic = this.fileManager.isPubliclyReadable(kind);
        if (typeof res.header === 'function') {
            res
                .header('content-type', object.contentType)
                .header('content-length', object.size)
                .header('content-disposition', 'inline')
                .header('cache-control', isPublic ? 'public, max-age=300' : 'private, no-store');
            return res.send(object.stream);
        }
        res.setHeader('content-type', object.contentType);
        res.setHeader('content-length', object.size);
        res.setHeader('content-disposition', 'inline');
        res.setHeader('cache-control', isPublic ? 'public, max-age=300' : 'private, no-store');
        object.stream.pipe(res);
    }
    async deleteObjects(kindRaw, body) {
        const params = kindParamSchema.safeParse(kindRaw);
        if (!params.success)
            throw badRequest('invalid_request', 'invalid kind');
        const paths = [...new Set((body.paths || []).filter(Boolean))];
        if (!paths.length)
            return new ApiResponse({ removed: 0 });
        await this.service.deleteObjects(params.data, paths);
        return new ApiResponse({ removed: paths.length });
    }
};
__decorate([
    Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN),
    AnyStaff(),
    Post(':kind'),
    __param(0, CallerDecorator()),
    __param(1, ClaimsDecorator()),
    __param(2, Param('kind')),
    __param(3, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, UploadObjectDto]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "uploadObject", null);
__decorate([
    Public(),
    Get(':kind/url'),
    __param(0, ClaimsDecorator()),
    __param(1, Param('kind')),
    __param(2, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, GetSignedUrlQueryDto]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getSignedUrl", null);
__decorate([
    Public(),
    HttpCode(HttpStatus.OK),
    Post(':kind/urls'),
    __param(0, ClaimsDecorator()),
    __param(1, Param('kind')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, GetSignedUrlsBodyDto]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getSignedUrls", null);
__decorate([
    Public(),
    Get(':kind/object'),
    __param(0, Param('kind')),
    __param(1, Query()),
    __param(2, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, GetObjectQueryDto, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getObject", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Page('faceImages', 'delete'),
    Delete(':kind'),
    __param(0, Param('kind')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, DeleteObjectsBodyDto]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "deleteObjects", null);
StorageController = __decorate([
    Controller('api/v1/storage'),
    __metadata("design:paramtypes", [StorageService,
        FileManager])
], StorageController);
export { StorageController };
//# sourceMappingURL=storage.controller.js.map