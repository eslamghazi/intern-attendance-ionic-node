import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { AttendanceRepository } from './attendance.repository.js';
import { cairoNow } from '../../domain/clock.js';
import { previousDate } from '../../domain/attendance/windows.js';
import { bypassSnapshot, checkGates, resolveBypass } from '../../domain/attendance/gates.js';
import { decideCheckIn, decideCheckOut, type OpenSlot } from '../../domain/attendance/slot.js';
import {
  refuse,
  type CheckPayload,
  type Refusal,
} from '../../domain/attendance/types.js';
import { notFound, forbidden } from '../../http/errors.js';
import type { Caller } from '../../domain/identity/role.js';
import { scopeOf } from '../../common/auth/access.service.js';
import { coversUnit } from '../../domain/access/scope.js';
import { FileCategory, FileManager } from '../../infrastructure/storage/file-manager.service.js';

export interface SetAttendanceInput {
  memberId: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'early_leave' | null;
  clear: boolean;
  shiftId: string | null;
}

export interface CheckResult {
  ok: true;
  type: 'check_in' | 'check_out';
  status: string;
  distance: number;
  shift: string | null;
}

export class AttendanceRefused extends Error {
  constructor(readonly refusal: Refusal) {
    super(refusal.reason);
    this.name = 'AttendanceRefused';
  }
}

import type { IAttendanceService } from './interfaces/attendance.interface.js';

@Injectable()
export class AttendanceService implements IAttendanceService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: AttendanceRepository,
    private readonly fileManager: FileManager,
  ) {}

  private async storeProbe(
    payload: CheckPayload,
    keep: boolean,
    profileId: string,
    memberId: string,
    date: string,
    shiftId: string,
  ): Promise<string | null> {
    if (!keep || !payload.probeBase64) return payload.probePath;
    try {
      const bytes = this.fileManager.decodeBase64Image(payload.probeBase64);
      if (!bytes) return payload.probePath;
      const naming = await this.repo.probeNaming(profileId);
      const folder = naming?.groupYear ? String(naming.groupYear) : 'group';
      const code = String(naming?.code ?? memberId).replace(/[^A-Za-z0-9_-]+/g, '_');
      const path = `${folder}/${code}/${date}-${shiftId}-${payload.type}.jpg`;
      
      await this.fileManager.upload({
        category: FileCategory.PROBE,
        path,
        body: bytes,
        contentType: 'image/jpeg',
        owner: profileId,
        tx: { execute: async () => {}, query: async () => [] } as any, // Not strictly required if storage is standalone
      });
      return path;
    } catch {
      return payload.probePath;
    }
  }

  async recordAttendance(callerId: string, payload: CheckPayload): Promise<CheckResult> {
    return this.uow.asService(async () => {
      const member = await this.repo.loadMemberContext(callerId);
      if (!member || !member.isActive) throw new AttendanceRefused(refuse(403, 'not_a_member'));

      const settings = await this.repo.loadSettings();
      if (!settings) throw new AttendanceRefused(refuse(500, 'no_settings'));

      const effectiveNow = member.frozenAt ? new Date(member.frozenAt) : new Date();
      const { date, minutesOfDay } = cairoNow(effectiveNow);

      let qrAccepted = false;
      if (payload.qrToken) {
        const probe = resolveBypass({ settings, member, now: effectiveNow });
        if (!probe.location) {
          if (!probe.qrEnabled) throw new AttendanceRefused(refuse(422, 'qr_disabled'));
          qrAccepted = await this.repo.redeemQrToken({
            token: payload.qrToken,
            branchId: member.branchId,
            memberId: member.id,
            date: cairoNow().date,
            requiresMember: settings.qrRequiresMember,
          });
          if (!qrAccepted) {
            await this.repo.writeAudit(callerId, 'out_of_range', { qr: 'invalid' });
            throw new AttendanceRefused(refuse(422, 'qr_invalid'));
          }
        }
      }

      const bypass = resolveBypass({
        settings,
        member,
        now: effectiveNow,
        qrAccepted,
      });

      const geofence = bypass.location
        ? null
        : await this.repo.geofenceCheck(member.branchId, payload.lat, payload.lng);

      const gates = checkGates(payload, settings, bypass, member, geofence);
      if (gates.audit) await this.repo.writeAudit(callerId, gates.audit.event, gates.audit.detail);
      if (gates.refusal) throw new AttendanceRefused(gates.refusal);

      const distance = gates.distance;
      const snapshot = bypassSnapshot(bypass);
      const ctx = {
        settings,
        minutesOfDay,
        defaults: { shift_start: settings.shiftStart, shift_end: settings.shiftEnd },
      };
      const nowIso = effectiveNow.toISOString();
      const todayAttendance = await this.repo.attendanceOn(member.id, date);

      if (payload.type === 'check_in') {
        const rostered = await this.repo.rosteredShifts(member.id, date);
        const decision = decideCheckIn(rostered, todayAttendance, ctx);
        if (!decision.ok) {
          const audit = decision.refusal.detail?.audit;
          if (typeof audit === 'string') {
            await this.repo.writeAudit(callerId, audit, { type: 'check_in' });
          }
          throw new AttendanceRefused(decision.refusal);
        }

        const { shift, status } = decision.value;
        const probePath = await this.storeProbe(
          payload, settings.storeProbeImages, callerId, member.id, date, shift.id,
        );

        const written = await this.repo.writeCheckIn({
          memberId: member.id,
          branchId: member.branchId,
          date,
          status,
          shiftId: shift.id,
          shiftName: shift.name,
          atIso: nowIso,
          lat: payload.lat,
          lng: payload.lng,
          accuracy: payload.accuracy,
          distance,
          faceScore: payload.faceScore,
          livenessPassed: payload.livenessPassed,
          isMock: payload.isMock,
          probePath,
          bypass: snapshot,
        });

        if (!written) throw new AttendanceRefused(refuse(409, 'already_checked_in'));

        await this.repo.writeAudit(callerId, 'check_in', { date, status, distance, shift: shift.name });
        return { ok: true, type: 'check_in', status, distance, shift: shift.name };
      }

      const yDate = previousDate(date);
      const toOpen = (records: typeof todayAttendance, d: string): OpenSlot[] =>
        records.filter((a) => a.checkInAt && !a.checkOutAt).map((record) => ({ record, date: d }));

      const decision = decideCheckOut(
        toOpen(todayAttendance, date),
        toOpen(await this.repo.attendanceOn(member.id, yDate), yDate),
        ctx,
        bypass,
      );
      
      if (!decision.ok) {
        const audit = decision.refusal.detail?.audit;
        if (typeof audit === 'string') {
          await this.repo.writeAudit(callerId, audit, { type: 'check_out' });
        }
        throw new AttendanceRefused(decision.refusal);
      }

      const out = decision.value;
      const probePath = await this.storeProbe(
        payload, settings.storeProbeImages, callerId, member.id, date, out.record.shiftId ?? 'x',
      );

      await this.repo.writeCheckOut({
        id: out.record.id,
        checkoutStatus: out.checkoutStatus,
        atIso: nowIso,
        lat: payload.lat,
        lng: payload.lng,
        accuracy: payload.accuracy,
        distance,
        faceScore: payload.faceScore,
        livenessPassed: payload.livenessPassed,
        isMock: payload.isMock,
        probePath,
        bypass: snapshot,
      });
      await this.repo.writeAudit(callerId, 'check_out', { date: out.date, status: out.record.status, distance });

      return { ok: true, type: 'check_out', status: out.record.status, distance, shift: out.shift?.name ?? null };
    });
  }

  async setAttendanceManually(caller: Caller, input: SetAttendanceInput): Promise<{ ok: true; cleared?: true }> {
    return this.uow.asCaller(caller as any, async () => {
      const scope = await scopeOf((this.repo as any).db, caller);
      
      const member = await this.repo.getMemberBranch(input.memberId);
      if (!member) throw notFound('member_not_found');

      if (scope.kind !== 'all') {
        const unit = { branchId: member.branchId, groupId: member.groupId };
        if (!coversUnit(scope, unit)) throw notFound('member_not_found');
      }

      if (input.clear) {
        await this.repo.manualClear(input.memberId, input.date, input.shiftId);
        return { ok: true, cleared: true };
      }

      const resolved = await this.repo.manualSetShift(input.memberId, input.date, input.shiftId);
      const shiftId = resolved.shift_id ?? null;
      const came = input.status !== 'absent';

      await this.repo.manualUpsert({
        memberId: input.memberId,
        branchId: member.branchId,
        date: input.date,
        status: input.status as string,
        shiftId,
        shiftName: resolved.shift_name,
        came,
      });

      return { ok: true };
    });
  }
}
