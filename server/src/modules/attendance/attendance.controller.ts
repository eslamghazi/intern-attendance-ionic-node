import { Controller, Post, Body } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { ApiError, badRequest } from '../../http/errors.js';
import type { CheckPayload } from '../../domain/attendance/types.js';
import { AttendanceService, AttendanceRefused } from './attendance.service.js';
import { ApiResponse } from '../../common/dto/api-response.dto.js';
import { recordAttendanceSchema, setManualAttendanceSchema } from './dto/attendance.dto.js';

function toPayload(b: z.infer<typeof recordAttendanceSchema>): CheckPayload {
  return {
    type: b.type,
    lat: b.lat,
    lng: b.lng,
    accuracy: b.accuracy,
    isMock: b.is_mock,
    livenessPassed: b.liveness_passed,
    faceScore: b.face_score ?? null,
    probePath: b.probe_path ?? null,
    probeBase64: b.probe_base64 ?? null,
    integrityToken: b.integrity_token ?? null,
    qrToken: b.qr_token ?? null,
  };
}

@Controller('api/v1/attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post('record')
  async record(
    @CallerDecorator() caller: Caller | null,
    @Body() body: unknown,
  ) {
    const parsed = recordAttendanceSchema.safeParse(body);
    if (!parsed.success) throw badRequest('invalid_type', 'invalid attendance payload');

    try {
      const data = await this.service.recordAttendance(caller!.id, toPayload(parsed.data));
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

  @Roles('admin', 'superadmin')
  @Post('set')
  async setManual(
    @CallerDecorator() caller: Caller | null,
    @Body() body: unknown,
  ) {
    const parsed = setManualAttendanceSchema.safeParse(body);
    if (!parsed.success) throw badRequest('missing', 'member_id and date are required');
    const b = parsed.data;
    const data = await this.service.setAttendanceManually(caller!, {
      memberId: b.member_id,
      date: b.date,
      status: b.status as any,
      clear: Boolean(b.clear),
      shiftId: b.shift_id ?? null,
    });
    return new ApiResponse(data);
  }
}
