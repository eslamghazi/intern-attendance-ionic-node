import { AttendanceResultDto } from './dto/attendance.dto.js';
import { AttendanceStatus } from '../../common/enums/index.js';

import { CheckType } from '../../common/enums/index.js';

export class AttendanceMapper {
  static toResult(data: any): AttendanceResultDto {
    return {
      ok: data?.ok ?? true,
      type: data?.type ?? CheckType.CHECK_IN,
      status: data?.status ?? AttendanceStatus.PRESENT,
      distance: data?.distance ?? 0,
      shift: data?.shift ?? data?.shift_name ?? null,
      time: data?.time ?? data?.check_in_at ?? data?.check_out_at ?? null,
      shift_name: data?.shift_name ?? data?.shiftName ?? null,
    };
  }
}
