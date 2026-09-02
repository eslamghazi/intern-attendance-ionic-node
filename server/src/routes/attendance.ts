// HTTP for attendance. Parse, authorize, delegate, respond — nothing else.
// The rules live in src/domain/attendance, the orchestration in
// src/services/attendanceService.ts, the SQL in src/data/attendance.ts.
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { AttendanceRefused, recordAttendance } from '../services/attendanceService.js';
import { setAttendanceManually } from '../services/attendanceAdminService.js';
import { ApiError, badRequest } from '../http/errors.js';
import type { CheckPayload } from '../domain/attendance/types.js';

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
  // Accepted and ignored: which shift an action belongs to is derived from the
  // roster and the open window, never taken from the device.
  shift_id: z.string().nullish(),
});

const setBody = z.object({
  member_id: z.string().uuid(),
  date: z.string().trim().min(1),
  status: z.enum(['present', 'late', 'absent', 'early_leave']).optional(),
  clear: z.boolean().optional(),
  shift_id: z.string().uuid().nullish(),
});

/** Wire shape -> domain shape. */
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

export const attendanceRoutes: FastifyPluginAsync = async (app) => {
  app.post('/attendance/record', { preHandler: app.requireAuth }, async (req) => {
    const parsed = recordBody.safeParse(req.body);
    if (!parsed.success) throw badRequest('invalid_type', 'invalid attendance payload');

    try {
      return await recordAttendance(req.caller!.id, toPayload(parsed.data));
    } catch (err) {
      if (!(err instanceof AttendanceRefused)) throw err;
      // Refusals answer with their own `{ reason, … }` body: the app switches on
      // that reason to choose what the student is told. `audit` is internal
      // routing for the audit log and must not leak into the response.
      const { status, reason, detail } = err.refusal;
      const { audit: _audit, ...visible } = detail ?? {};
      const api = new ApiError(status, reason, reason);
      api.payload = { reason, ...visible };
      throw api;
    }
  });

  /** Manual override by an admin, bypassing the check-in flow entirely. */
  app.post(
    '/attendance/set',
    { preHandler: app.requireRole('admin', 'superadmin') },
    async (req) => {
      const parsed = setBody.safeParse(req.body);
      if (!parsed.success) throw badRequest('missing', 'member_id and date are required');
      const b = parsed.data;
      return setAttendanceManually(req.caller!, {
        memberId: b.member_id,
        date: b.date,
        status: b.status ?? null,
        clear: Boolean(b.clear),
        shiftId: b.shift_id ?? null,
      });
    },
  );
};
