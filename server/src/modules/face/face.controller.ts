import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator, Claims as ClaimsDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import type { JwtClaims } from '../../db/context.js';
import { badRequest } from '../../http/errors.js';
import { FaceService } from './face.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import {
  EnrollPhotoDto,
  ResetFaceDto,
  LookupFaceDto,
  PutTemplateDto,
  GetTemplatePhotosDto,
  ToolResetDto,
  LookupFaceResponseDto,
  TemplateResponseDto,
  TemplatePhotoItemDto,
} from './dto/face.dto.js';
import { FaceMapper } from './face.mapper.js';
import { Role } from '../../common/enums/index.js';

@ApiTags('Face')
@ApiBearerAuth()
@Controller('api/v1/face')
export class FaceController {
  constructor(private readonly faceService: FaceService) {}

  @Roles(Role.MEMBER)
  @Post('enroll-photo')
  @ApiOperation({ summary: 'Enroll face photo for member' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: boolean; path?: string; skipped?: boolean }> })
  async enrollPhoto(
    @CallerDecorator() caller: Caller | null,
    @Body() body: EnrollPhotoDto,
  ): Promise<ApiResponse<{ ok: boolean; path?: string; skipped?: boolean }>> {
    if (!body?.image_base64) throw badRequest('invalid_body', 'image_base64 is required');

    const data = await this.faceService.enrollPhoto(caller!, body.image_base64);
    return new ApiResponse(data);
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post('reset')
  @ApiOperation({ summary: 'Reset face biometrics for a member (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: boolean }> })
  async resetFace(
    @CallerDecorator() caller: Caller | null,
    @Body() body: ResetFaceDto,
  ): Promise<ApiResponse<{ ok: boolean }>> {
    if (!body?.member_id) throw badRequest('invalid_body', 'member_id is required');

    const data = await this.faceService.resetFace(caller!, body.member_id);
    return new ApiResponse(data);
  }

  @Post('lookup')
  @ApiOperation({ summary: 'Lookup member biometric status by numeric code' })
  @SwaggerResponse({ status: 200, type: ApiResponse<LookupFaceResponseDto> })
  async lookup(
    @CallerDecorator() caller: Caller | null,
    @Body() body: LookupFaceDto,
  ): Promise<ApiResponse<LookupFaceResponseDto>> {
    if (!body?.code) throw badRequest('invalid_body', 'code is required');

    const data = await this.faceService.lookup(caller!, body.code);
    return new ApiResponse(FaceMapper.toLookupResponse(data));
  }

  @Get('templates/:memberId')
  @ApiOperation({ summary: 'Get face embedding template for member' })
  @SwaggerResponse({ status: 200, type: ApiResponse<TemplateResponseDto> })
  async getTemplate(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('memberId') memberId: string,
  ): Promise<ApiResponse<TemplateResponseDto>> {
    const data = await this.faceService.getTemplate(claims, memberId);
    return new ApiResponse(data);
  }

  @Put('templates/:memberId')
  @ApiOperation({ summary: 'Upsert face embedding template' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: boolean }> })
  async putTemplate(
    @ClaimsDecorator() claims: JwtClaims,
    @Param('memberId') memberId: string,
    @Body() body: PutTemplateDto,
  ): Promise<ApiResponse<{ ok: boolean }>> {
    if (!body?.embedding) throw badRequest('invalid_body', 'embedding is required');

    const data = await this.faceService.putTemplate(claims, memberId, {
      embedding: body.embedding,
      photo_path: body.photo_path ?? null,
      quality_score: body.quality_score ?? null,
    });
    return new ApiResponse(data);
  }

  @Post('templates/photos')
  @ApiOperation({ summary: 'Get photo paths for list of members' })
  @SwaggerResponse({ status: 200, type: ApiResponse<TemplatePhotoItemDto[]> })
  async getTemplatePhotos(
    @ClaimsDecorator() claims: JwtClaims,
    @Body() body: GetTemplatePhotosDto,
  ): Promise<ApiResponse<TemplatePhotoItemDto[]>> {
    if (!body?.member_ids) throw badRequest('invalid_body', 'member_ids is required');

    const rows = await this.faceService.getTemplatePhotos(claims, body.member_ids);
    return new ApiResponse(FaceMapper.toPhotoItems(rows));
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('templates/photo-paths')
  @ApiOperation({ summary: 'Get all enrolled face template photo paths (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<(string | null)[]> })
  async getTemplatePhotoPaths(@ClaimsDecorator() claims: JwtClaims): Promise<ApiResponse<(string | null)[]>> {
    const data = await this.faceService.getTemplatePhotoPaths(claims);
    return new ApiResponse(data);
  }

  @Post('tool-reset')
  @ApiOperation({ summary: 'Reset face biometrics using tool kiosk' })
  @SwaggerResponse({ status: 200, type: ApiResponse<{ ok: boolean }> })
  async toolReset(
    @CallerDecorator() caller: Caller | null,
    @Body() body: ToolResetDto,
  ): Promise<ApiResponse<{ ok: boolean }>> {
    if (!body?.member_id) throw badRequest('invalid_body', 'member_id is required');

    const data = await this.faceService.toolReset(caller!, body.member_id);
    return new ApiResponse(data);
  }

}
