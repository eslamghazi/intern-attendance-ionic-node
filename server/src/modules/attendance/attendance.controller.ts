import { Controller, Post, Body } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Caller as CallerDecorator } from '../../common/decorators/caller.decorator.js';
import type { Caller } from '../../common/types.js';
import { ApiError, badRequest } from '../../http/errors.js';
import type { CheckPayload } from '../../domain/attendance/types.js';
import { AttendanceService, AttendanceRefused } from './attendance.service.js';

const recordBody = z.object({
  type: z.enum(['check_in', 'check_out']),
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number(),
  is_mock: z.boolean().default(false),
  liveness_passed: z.boolean().default(false),
  face_score: z.number().nullish(),
  probe_path: z.string().nullish(),
  probe_base64: z.string().nullish(),
  integrity_token: z.string().nullish(),
  qr_token: z.string().nullish(),
  shift_id: z.string().nullish(),
});

const setBody = z.object({
  member_id: z.string().uuid(),
  date: z.string().trim().min(1),
  status: z.enum(['present', 'late', 'absent', 'early_leave']).optional(),
  clear: z.boolean().optional(),
  shift_id: z.string().uuid().nullish(),
});

function toPayload(b: z.infer<typeof recordBody>): CheckPayload {
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
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = recordBody.safeParse(body);
    if (!parsed.success) throw badRequest('invalid_type', 'invalid attendance payload');

    try {
      return await this.service.recordAttendance(caller.id, toPayload(parsed.data));
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
    @CallerDecorator() caller: Caller,
    @Body() body: unknown,
  ) {
    const parsed = setBody.safeParse(body);
    if (!parsed.success) throw badRequest('missing', 'member_id and date are required');
    const b = parsed.data;
    return this.service.setAttendanceManually(caller, {
      memberId: b.member_id,
      date: b.date,
      status: b.status as any,
      clear: Boolean(b.clear),
      shiftId: b.shift_id ?? null,
    });
  }
}
