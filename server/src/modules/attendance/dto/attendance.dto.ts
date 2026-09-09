import { z } from 'zod';

export const recordAttendanceSchema = z.object({
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

export const setManualAttendanceSchema = z.object({
  member_id: z.string().uuid(),
  date: z.string().trim().min(1),
  status: z.enum(['present', 'late', 'absent', 'early_leave']).optional(),
  clear: z.boolean().optional(),
  shift_id: z.string().uuid().nullish(),
});
