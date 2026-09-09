import { AttendanceResultDto } from './dto/attendance.dto.js';

export class AttendanceMapper {
  static toResult(data: any): AttendanceResultDto {
    return {
      status: data?.status ?? 'present',
      time: data?.time ?? data?.check_in_at ?? data?.check_out_at,
      shift_name: data?.shift_name ?? data?.shiftName,
    };
  }
}
