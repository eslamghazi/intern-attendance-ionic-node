import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../common/database/generic.repository.js';
import {
  attendance,
  members,
  branches,
  groups,
  appSettings,
  qrTokens,
  rosterDays,
  shifts,
  memberDirectory,
  auditLog,
} from '../../db/schema/index.js';
import {
  eq,
  and,
  desc,
  sql,
  isNull,
  isNotNull,
} from 'drizzle-orm';
import type { ShiftRow } from '../../domain/attendance/windows.js';
import type { AttendanceRecord, AttendanceSettings, MemberContext } from '../../domain/attendance/types.js';
import type { GeofenceResult } from '../../domain/attendance/gates.js';

export interface CheckInWrite {
  memberId: string;
  branchId: string;
  date: string;
  status: 'present' | 'late';
  shiftId: string;
  shiftName: string;
  atIso: string;
  lat: number;
  lng: number;
  accuracy: number;
  distance: number;
  faceScore: number | null;
  livenessPassed: boolean;
  isMock: boolean;
  probePath: string | null;
  bypass: Record<string, unknown> | null;
}

export interface CheckOutWrite {
  id: string;
  checkoutStatus: 'checked_out' | 'early_leave';
  atIso: string;
  lat: number;
  lng: number;
  accuracy: number;
  distance: number;
  faceScore: number | null;
  livenessPassed: boolean;
  isMock: boolean;
  probePath: string | null;
  bypass: Record<string, unknown> | null;
}

@Injectable()
export class AttendanceRepository extends GenericRepository<
  typeof attendance.$inferSelect,
  string,
  typeof attendance.$inferInsert,
  Partial<typeof attendance.$inferInsert>
> {
  constructor() {
    super(attendance, attendance.id);
  }

  async loadMemberContext(profileId: string): Promise<MemberContext | null> {
    const rows = await this.db
      .select({
        id: members.id,
        branch_id: members.branchId,
        group_id: members.groupId,
        is_active: members.isActive,
        enrollment_status: members.enrollmentStatus,
        frozen_at: members.frozenAt,
        location_bypass_until: members.locationBypassUntil,
        bypass_face: members.bypassFace,
        bypass_location: members.bypassLocation,
        bypass_checkout_window: members.bypassCheckoutWindow,
        b_face: branches.bypassFace,
        b_location: branches.bypassLocation,
        b_checkout: branches.bypassCheckoutWindow,
        b_block: branches.blockCheckin,
        b_qr_enabled: branches.qrEnabled,
        b_require_qr: branches.requireQr,
        g_face: groups.bypassFace,
        g_location: groups.bypassLocation,
        g_checkout: groups.bypassCheckoutWindow,
        branch_id_not_null: branches.id,
        group_id_not_null: groups.id,
      })
      .from(members)
      .leftJoin(branches, eq(branches.id, members.branchId))
      .leftJoin(groups, eq(groups.id, members.groupId))
      .where(eq(members.profileId, profileId))
      .limit(1);

    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      branchId: r.branch_id,
      groupId: r.group_id,
      isActive: r.is_active !== false,
      enrollmentStatus: r.enrollment_status,
      frozenAt: r.frozen_at,
      locationBypassUntil: r.location_bypass_until,
      bypassFace: Boolean(r.bypass_face),
      bypassLocation: Boolean(r.bypass_location),
      bypassCheckoutWindow: Boolean(r.bypass_checkout_window),
      branch: r.branch_id_not_null
        ? {
            bypassFace: Boolean(r.b_face),
            bypassLocation: Boolean(r.b_location),
            bypassCheckoutWindow: Boolean(r.b_checkout),
            blockCheckin: Boolean(r.b_block),
            qrEnabled: r.b_qr_enabled !== false,
            requireQr: Boolean(r.b_require_qr),
          }
        : null,
      group: r.group_id_not_null
        ? {
            bypassFace: Boolean(r.g_face),
            bypassLocation: Boolean(r.g_location),
            bypassCheckoutWindow: Boolean(r.g_checkout),
          }
        : null,
    };
  }

  async loadSettings(): Promise<AttendanceSettings | null> {
    const rows = await this.db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
    const s = rows[0];
    if (!s) return null;
    return {
      checkinMethod: (s.checkinMethod as AttendanceSettings['checkinMethod']) || 'both',
      enforceShiftWindow: Boolean(s.enforceShiftWindow),
      bypassCheckoutWindow: Boolean(s.bypassCheckoutWindow),
      bypassFace: Boolean(s.bypassFace),
      bypassLocation: Boolean(s.bypassLocation),
      livenessRequired: Boolean(s.livenessRequired),
      requirePlayIntegrity: Boolean(s.requirePlayIntegrity),
      faceMatchThreshold: Number(s.faceMatchThreshold),
      maxAccuracyMeters: Number(s.maxAccuracyMeters),
      qrRequiresMember: Boolean(s.qrRequiresMember),
      storeProbeImages: Boolean(s.storeProbeImages),
      shiftStart: s.shiftStart ?? null,
      shiftEnd: s.shiftEnd ?? null,
    };
  }

  async redeemQrToken(args: { token: string; branchId: string; memberId: string; date: string; requiresMember: boolean }): Promise<boolean> {
    const rows = await this.db.execute<{ id: string }>(sql`
      with candidate as (
        select q.id, q.single_use
          from public.qr_tokens q
         where q.token = ${args.token}
           and q.branch_id = ${args.branchId}
           and q.date = ${args.date}
           and q.expires_at > now()
           and (not q.single_use or q.used_at is null)
           and (q.member_id is null or q.member_id = ${args.memberId})
           and (${args.requiresMember}::boolean = false or q.member_id is not null)
         for update skip locked
         limit 1
      ),
      burned as (
        update public.qr_tokens t set used_at = now()
          from candidate c
         where t.id = c.id and c.single_use
        returning t.id
      )
      select id from candidate
    `);
    return (rows.rowCount ?? 0) > 0;
  }

  async geofenceCheck(branchId: string, lat: number, lng: number): Promise<GeofenceResult | null> {
    const rows = await this.db.execute<{ within: boolean; distance_m: number; radius_m: number }>(sql`
      select * from public.geofence_check(${branchId}, ${lat}, ${lng})
    `);
    const g = rows.rows[0];
    return g ? { within: g.within, distanceM: g.distance_m, radiusM: g.radius_m } : null;
  }

  async rosteredShifts(memberId: string, date: string): Promise<ShiftRow[]> {
    return this.db
      .select({
        id: shifts.id,
        name: shifts.name,
        checkin_open: shifts.checkinOpen,
        checkin_late: shifts.checkinLate,
        checkin_close: shifts.checkinClose,
        checkout_open: shifts.checkoutOpen,
        checkout_close: shifts.checkoutClose,
        start_time: shifts.startTime,
        end_time: shifts.endTime,
      })
      .from(rosterDays)
      .innerJoin(shifts, eq(shifts.id, rosterDays.shiftId))
      .where(and(eq(rosterDays.memberId, memberId), eq(rosterDays.date, date)));
  }

  async attendanceOn(memberId: string, date: string): Promise<AttendanceRecord[]> {
    const rows = await this.db
      .select({
        id: attendance.id,
        shift_id: attendance.shiftId,
        status: attendance.status,
        checkout_status: attendance.checkoutStatus,
        check_in_at: attendance.checkInAt,
        check_out_at: attendance.checkOutAt,
        shift: shifts,
      })
      .from(attendance)
      .leftJoin(shifts, eq(shifts.id, attendance.shiftId))
      .where(and(eq(attendance.memberId, memberId), eq(attendance.date, date)));

    return rows.map((r) => ({
      id: r.id,
      shiftId: r.shift_id,
      status: r.status,
      checkoutStatus: r.checkout_status,
      checkInAt: r.check_in_at,
      checkOutAt: r.check_out_at,
      shift: r.shift ? {
        id: r.shift.id,
        name: r.shift.name,
        checkin_open: r.shift.checkinOpen,
        checkin_late: r.shift.checkinLate,
        checkin_close: r.shift.checkinClose,
        checkout_open: r.shift.checkoutOpen,
        checkout_close: r.shift.checkoutClose,
        start_time: r.shift.startTime,
        end_time: r.shift.endTime,
      } as any : null,
    }));
  }

  async writeCheckIn(w: CheckInWrite): Promise<boolean> {
    const result = await this.db.execute(sql`
      insert into public.attendance (
        member_id, branch_id, date, status, shift_id, shift_name, check_in_at,
        check_in_lat, check_in_lng, check_in_accuracy_m, check_in_distance_m,
        check_in_face_score, check_in_liveness_passed, check_in_is_mock,
        check_in_probe_path, check_in_bypass
      ) values (
        ${w.memberId}, ${w.branchId}, ${w.date}, ${w.status}::public.attendance_status,
        ${w.shiftId}, ${w.shiftName}, ${w.atIso},
        ${w.lat}, ${w.lng}, ${w.accuracy}, ${w.distance},
        ${w.faceScore}, ${w.livenessPassed}, ${w.isMock},
        ${w.probePath}, ${w.bypass ? JSON.stringify(w.bypass) : null}::jsonb
      )
      on conflict (member_id, date, shift_id) do update set
        status = excluded.status,
        shift_name = excluded.shift_name,
        check_in_at = excluded.check_in_at,
        check_in_lat = excluded.check_in_lat,
        check_in_lng = excluded.check_in_lng,
        check_in_accuracy_m = excluded.check_in_accuracy_m,
        check_in_distance_m = excluded.check_in_distance_m,
        check_in_face_score = excluded.check_in_face_score,
        check_in_liveness_passed = excluded.check_in_liveness_passed,
        check_in_is_mock = excluded.check_in_is_mock,
        check_in_probe_path = excluded.check_in_probe_path,
        check_in_bypass = excluded.check_in_bypass
      where public.attendance.check_in_at is null
    `);
    return (result.rowCount ?? 0) > 0;
  }

  async writeCheckOut(w: CheckOutWrite): Promise<void> {
    await this.db
      .update(attendance)
      .set({
        checkoutStatus: w.checkoutStatus,
        checkOutAt: w.atIso,
        checkOutLat: w.lat,
        checkOutLng: w.lng,
        checkOutAccuracyM: w.accuracy,
        checkOutDistanceM: w.distance,
        checkOutFaceScore: w.faceScore,
        checkOutLivenessPassed: w.livenessPassed,
        checkOutIsMock: w.isMock,
        checkOutProbePath: w.probePath,
        checkOutBypass: w.bypass,
      })
      .where(eq(attendance.id, w.id));
  }

  async probeNaming(profileId: string): Promise<{ groupYear: number | null; code: string | null } | null> {
    const rows = await this.db
      .select({
        group_year: memberDirectory.groupYear,
        member_code: memberDirectory.memberCode,
        national_id: memberDirectory.nationalId,
      })
      .from(memberDirectory)
      .where(eq(memberDirectory.profileId, profileId))
      .limit(1);
    
    const r = rows[0];
    if (!r) return null;
    return { groupYear: r.group_year, code: r.member_code ?? r.national_id };
  }

  async writeAudit(actorId: string, event: string, detail: unknown): Promise<void> {
    try {
      await this.db.execute(sql`
        insert into public.audit_log (actor_id, event, detail)
        values (${actorId}, ${event}::public.audit_event, ${JSON.stringify(detail)}::jsonb)
      `);
    } catch {
      /* ignore */
    }
  }

  async manualClear(memberId: string, date: string, shiftId: string | null) {
    const conditions = [
      eq(attendance.memberId, memberId),
      eq(attendance.date, date),
    ];
    if (shiftId) conditions.push(eq(attendance.shiftId, shiftId));
    
    await this.db.delete(attendance).where(and(...conditions));
  }

  async getMemberBranch(memberId: string) {
    const rows = await this.db.select({ branchId: members.branchId, groupId: members.groupId }).from(members).where(eq(members.id, memberId)).limit(1);
    return rows[0] ?? null;
  }

  async manualSetShift(memberId: string, date: string, shiftId: string | null) {
    const rows = await this.db.execute<{ shift_id: string | null; shift_name: string | null }>(sql`
      with pick as (
        select coalesce(
                 ${shiftId}::uuid,
                 (select a.shift_id from public.attendance a
                   where a.member_id = ${memberId} and a.date = ${date}
                   order by a.check_in_at nulls last limit 1),
                 (select rd.shift_id from public.roster_days rd
                   where rd.member_id = ${memberId} and rd.date = ${date}
                   limit 1)
               ) as shift_id
      )
      select p.shift_id, s.name as shift_name
        from pick p left join public.shifts s on s.id = p.shift_id
    `);
    return rows.rows[0] ?? { shift_id: null, shift_name: null };
  }

  async manualUpsert(w: {
    memberId: string;
    branchId: string;
    date: string;
    status: string;
    shiftId: string | null;
    shiftName: string | null;
    came: boolean;
  }) {
    await this.db.execute(sql`
      insert into public.attendance (
        member_id, branch_id, date, status, shift_id, shift_name,
        check_in_at, check_in_is_mock, check_in_liveness_passed
      ) values (
        ${w.memberId}, ${w.branchId}, ${w.date},
        ${w.status}::public.attendance_status, ${w.shiftId},
        ${w.shiftName},
        ${w.came ? new Date().toISOString() : null}, false, ${w.came}
      )
      on conflict (member_id, date, shift_id) do update set
        status = excluded.status,
        shift_name = excluded.shift_name,
        check_in_at = excluded.check_in_at,
        check_in_is_mock = excluded.check_in_is_mock,
        check_in_liveness_passed = excluded.check_in_liveness_passed
    `);
  }
}
