import type { Caller } from '../../../common/types.js';
import type { CheckPayload, AttendanceRecord, AttendanceSettings, MemberContext } from '../../../domain/attendance/types.js';
import type { GeofenceResult } from '../../../domain/attendance/gates.js';
import type { ShiftRow } from '../../../domain/attendance/windows.js';
import type { IGenericRepository } from '../../../common/database/interfaces/generic-repository.interface.js';
import { attendance } from '../../../db/schema/index.js';
import type { CheckInWrite, CheckOutWrite } from '../attendance.repository.js';
import type { CheckResult, SetAttendanceInput } from '../attendance.service.js';

export interface IAttendanceService {
  recordAttendance(callerId: string, payload: CheckPayload): Promise<CheckResult>;
  setAttendanceManually(caller: Caller, input: SetAttendanceInput): Promise<{ ok: true; cleared?: true }>;
}

export interface IAttendanceRepository extends IGenericRepository<
  typeof attendance.$inferSelect,
  string,
  typeof attendance.$inferInsert,
  Partial<typeof attendance.$inferInsert>
> {
  loadMemberContext(profileId: string): Promise<MemberContext | null>;
  loadSettings(): Promise<AttendanceSettings | null>;
  redeemQrToken(args: { token: string; branchId: string; memberId: string; date: string; requiresMember: boolean }): Promise<boolean>;
  geofenceCheck(branchId: string, lat: number, lng: number): Promise<GeofenceResult | null>;
  rosteredShifts(memberId: string, date: string): Promise<ShiftRow[]>;
  attendanceOn(memberId: string, date: string): Promise<AttendanceRecord[]>;
  writeCheckIn(w: CheckInWrite): Promise<boolean>;
  writeCheckOut(w: CheckOutWrite): Promise<void>;
  probeNaming(profileId: string): Promise<{ groupYear: number | null; code: string | null } | null>;
  writeAudit(actorId: string, event: string, detail: unknown): Promise<void>;
  manualClear(memberId: string, date: string, shiftId: string | null): Promise<void>;
  getMemberBranch(memberId: string): Promise<{ branchId: string; groupId: string | null } | null>;
  manualSetShift(memberId: string, date: string, shiftId: string | null): Promise<{ shift_id: string | null; shift_name: string | null }>;
  manualUpsert(w: {
    memberId: string;
    branchId: string;
    date: string;
    status: string;
    shiftId: string | null;
    shiftName: string | null;
    came: boolean;
  }): Promise<void>;
}
