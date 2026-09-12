import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Page } from '../../common/decorators/page.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { ApiError, badRequest } from '../../common/errors.js';
import type { CheckPayload } from '../../domain/attendance/types.js';
import { AttendanceService, AttendanceRefused } from './attendance.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import {
  RecordAttendanceDto,
  SetManualAttendanceDto,
  ImportAttendanceDto,
  ImportAttendanceResultDto,
  AttendanceResultDto,
  SetAttendanceResponseDto,
} from './dto/attendance.dto.js';
import { Role } from '../../common/enums/index.js';

function toPayload(b: RecordAttendanceDto): CheckPayload {
  return {
    type: b.type,
    lat: b.lat,
    lng: b.lng,
    accuracy: b.accuracy,
    isMock: Boolean(b.is_mock),
    livenessPassed: Boolean(b.liveness_passed),
    faceScore: b.face_score ?? null,
    probeEmbedding: Array.isArray(b.probe_embedding) ? b.probe_embedding : null,
    probePath: b.probe_path ?? null,
    probeBase64: b.probe_base64 ?? null,
    integrityToken: b.integrity_token ?? null,
    qrToken: b.qr_token ?? null,
  };
}


@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('api/v1/attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Roles(Role.MEMBER)
  @HttpCode(HttpStatus.OK)
  @Post('record')
  @ApiOperation({ summary: 'Record biometric and geofenced check-in or check-out' })
  @SwaggerResponse({ status: 200, type: ApiResponse<AttendanceResultDto> })
  async record(
    @CallerDecorator() caller: Caller | null,
    @Body() body: RecordAttendanceDto,
  ): Promise<ApiResponse<AttendanceResultDto>> {
    if (!body?.type || body.lat === undefined || body.lng === undefined) {
      throw badRequest('invalid_type', 'invalid attendance payload');
    }

    try {
      const data = await this.service.recordAttendance(caller!.id, toPayload(body));
      return new ApiResponse(data);
    } catch (err) {
      if (!(err instanceof AttendanceRefused)) throw err;
      const { status, reason, detail } = err.refusal;
      const { audit: _audit, ...visible } = detail ?? {};
      const api = new ApiError(status, reason, reason);
      api.payload = { reason, ...visible };
      throw api;
    }
  }

  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @Page('review', 'edit')
  @Post('set')
  @ApiOperation({ summary: 'Manually record or override member attendance (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<SetAttendanceResponseDto> })
  async setManual(
    @CallerDecorator() caller: Caller | null,
    @Body() body: SetManualAttendanceDto,
  ): Promise<ApiResponse<SetAttendanceResponseDto>> {
    if (!body?.member_id || !body?.date) {
      throw badRequest('missing', 'member_id and date are required');
    }

    const data = await this.service.setAttendanceManually(caller!, {
      memberId: body.member_id,
      date: body.date,
      status: body.status as any,
      clear: Boolean(body.clear),
      shiftId: body.shift_id ?? null,
    });
    return new ApiResponse(data);
  }

  /**
   * Attendance from a file, written only onto rostered slots. Reached from
   * the roster page (beside the roster upload) and from the review page, so
   * either page's edit grant admits it.
   */
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @Page(['rosters', 'review'], 'edit')
  @Post('import')
  @ApiOperation({ summary: 'Import check-in/check-out times onto rostered slots (Admin only)' })
  @SwaggerResponse({ status: 200, type: ApiResponse<ImportAttendanceResultDto> })
  async importAttendance(
    @CallerDecorator() caller: Caller | null,
    @Body() body: ImportAttendanceDto,
  ): Promise<ApiResponse<ImportAttendanceResultDto>> {
    const data = await this.service.importAttendance(
      caller!,
      body.rows.map((r) => ({
        memberId: r.member_id,
        date: r.date,
        shiftId: r.shift_id,
        checkIn: r.check_in?.trim() || null,
        checkOut: r.check_out?.trim() || null,
      })),
    );
    return new ApiResponse(data);
  }
}
