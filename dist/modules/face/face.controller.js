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
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import { badRequest } from '../../common/errors.js';
import { FaceService } from './face.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { EnrollPhotoDto, ResetFaceDto, LookupFaceDto, PutTemplateDto, GetTemplatePhotosDto, ToolResetDto, } from './dto/face.dto.js';
import { FaceMapper } from './face.mapper.js';
import { Role } from '../../common/enums/index.js';
let FaceController = class FaceController {
    faceService;
    constructor(faceService) {
        this.faceService = faceService;
    }
    async enrollPhoto(caller, body) {
        if (!body?.image_base64)
            throw badRequest('invalid_body', 'image_base64 is required');
        const data = await this.faceService.enrollPhoto(caller, body.image_base64);
        return new ApiResponse(data);
    }
    async resetFace(caller, body) {
        if (!body?.member_id)
            throw badRequest('invalid_body', 'member_id is required');
        const data = await this.faceService.resetFace(caller, body.member_id);
        return new ApiResponse(data);
    }
    async lookup(caller, body) {
        if (!body?.code)
            throw badRequest('invalid_body', 'code is required');
        const data = await this.faceService.lookup(caller, body.code);
        return new ApiResponse(FaceMapper.toLookupResponse(data));
    }
    async getTemplate(caller, memberId) {
        const data = await this.faceService.getTemplate(caller, memberId);
        return new ApiResponse(data);
    }
    async putTemplate(caller, memberId, body) {
        if (!body?.embedding)
            throw badRequest('invalid_body', 'embedding is required');
        const data = await this.faceService.putTemplate(caller, memberId, {
            embedding: body.embedding,
            photo_path: body.photo_path ?? null,
            quality_score: body.quality_score ?? null,
        });
        return new ApiResponse(data);
    }
    // STAFF ONLY. This takes arbitrary member ids and answers with their
    // enrolment photo PATHS, and the service does not re-check them — so the
    // decorator is the whole of the access control on this route.
    //
    // A path is not the image (signing is checked separately), but the storage
    // tree is deliberately descriptive —
    // `faces/year-2026/branch-<name>/group-<name>/member-<code>/face.jpg` — so a
    // path alone discloses another member's code, branch and group.
    async getTemplatePhotos(body) {
        if (!body?.member_ids)
            throw badRequest('invalid_body', 'member_ids is required');
        const rows = await this.faceService.getTemplatePhotos(body.member_ids);
        return new ApiResponse(FaceMapper.toPhotoItems(rows));
    }
    async getTemplatePhotoPaths() {
        const data = await this.faceService.getTemplatePhotoPaths();
        return new ApiResponse(data);
    }
    async toolReset(caller, body) {
        if (!body?.member_id)
            throw badRequest('invalid_body', 'member_id is required');
        const data = await this.faceService.toolReset(caller, body.member_id);
        return new ApiResponse(data);
    }
};
__decorate([
    Roles(Role.MEMBER),
    Post('enroll-photo'),
    ApiOperation({ summary: 'Enroll face photo for member' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, EnrollPhotoDto]),
    __metadata("design:returntype", Promise)
], FaceController.prototype, "enrollPhoto", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Post('reset'),
    ApiOperation({ summary: 'Reset face biometrics for a member (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ResetFaceDto]),
    __metadata("design:returntype", Promise)
], FaceController.prototype, "resetFace", null);
__decorate([
    Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Post('lookup'),
    ApiOperation({ summary: 'Lookup member biometric status by numeric code' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, LookupFaceDto]),
    __metadata("design:returntype", Promise)
], FaceController.prototype, "lookup", null);
__decorate([
    Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN),
    Get('templates/:memberId'),
    ApiOperation({ summary: 'Get face embedding template for member' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Param('memberId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FaceController.prototype, "getTemplate", null);
__decorate([
    Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN),
    Put('templates/:memberId'),
    ApiOperation({ summary: 'Upsert face embedding template' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Param('memberId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, PutTemplateDto]),
    __metadata("design:returntype", Promise)
], FaceController.prototype, "putTemplate", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Post('templates/photos'),
    ApiOperation({ summary: 'Get photo paths for list of members (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GetTemplatePhotosDto]),
    __metadata("design:returntype", Promise)
], FaceController.prototype, "getTemplatePhotos", null);
__decorate([
    Roles(Role.ADMIN, Role.SUPERADMIN),
    Get('templates/photo-paths'),
    ApiOperation({ summary: 'Get all enrolled face template photo paths (Admin only)' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FaceController.prototype, "getTemplatePhotoPaths", null);
__decorate([
    Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN),
    HttpCode(HttpStatus.OK),
    Post('tool-reset'),
    ApiOperation({ summary: 'Reset face biometrics using tool kiosk' }),
    SwaggerResponse({ status: 200, type: (ApiResponse) }),
    __param(0, CallerDecorator()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ToolResetDto]),
    __metadata("design:returntype", Promise)
], FaceController.prototype, "toolReset", null);
FaceController = __decorate([
    ApiTags('Face'),
    ApiBearerAuth(),
    Controller('api/v1/face'),
    __metadata("design:paramtypes", [FaceService])
], FaceController);
export { FaceController };
//# sourceMappingURL=face.controller.js.map