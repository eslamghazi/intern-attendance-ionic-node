var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { AttendanceRepository } from './attendance.repository.js';
import { cairoNow } from '../../domain/clock.js';
import { previousDate } from '../../domain/attendance/windows.js';
import { bypassSnapshot, checkGates, resolveBypass } from '../../domain/attendance/gates.js';
import { decideCheckIn, decideCheckOut } from '../../domain/attendance/slot.js';
import { refuse, } from '../../domain/attendance/types.js';
import { notFound } from '../../http/errors.js';
import { scopeOf } from '../../common/auth/access.service.js';
import { coversUnit } from '../../domain/access/scope.js';
import { FileCategory, FileManager } from '../../infrastructure/storage/file-manager.service.js';
import { CheckType, AuditEvent, AttendanceRefusalReason, AttendanceStatus, } from '../../common/enums/index.js';
export class AttendanceRefused extends Error {
    refusal;
    constructor(refusal) {
        super(refusal.reason);
        this.refusal = refusal;
        this.name = 'AttendanceRefused';
    }
}
let AttendanceService = class AttendanceService {
    uow;
    repo;
    fileManager;
    constructor(uow, repo, fileManager) {
        this.uow = uow;
        this.repo = repo;
        this.fileManager = fileManager;
    }
    async storeProbe(payload, keep, profileId, memberId, date, shiftId) {
        if (!keep || !payload.probeBase64)
            return payload.probePath;
        try {
            const bytes = this.fileManager.decodeBase64Image(payload.probeBase64);
            if (!bytes)
                return payload.probePath;
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
                tx: { execute: async () => { }, query: async () => [] }, // Not strictly required if storage is standalone
            });
            return path;
        }
        catch {
            return payload.probePath;
        }
    }
    async recordAttendance(callerId, payload) {
        return this.uow.asService(async () => {
            const member = await this.repo.loadMemberContext(callerId);
            if (!member || !member.isActive)
                throw new AttendanceRefused(refuse(403, AttendanceRefusalReason.NOT_A_MEMBER));
            const settings = await this.repo.loadSettings();
            if (!settings)
                throw new AttendanceRefused(refuse(500, AttendanceRefusalReason.NO_SETTINGS));
            const effectiveNow = member.frozenAt ? new Date(member.frozenAt) : new Date();
            const { date, minutesOfDay } = cairoNow(effectiveNow);
            let qrAccepted = false;
            if (payload.qrToken) {
                const probe = resolveBypass({ settings, member, now: effectiveNow });
                if (!probe.location) {
                    if (!probe.qrEnabled)
                        throw new AttendanceRefused(refuse(422, AttendanceRefusalReason.QR_DISABLED));
                    qrAccepted = await this.repo.redeemQrToken({
                        token: payload.qrToken,
                        branchId: member.branchId,
                        memberId: member.id,
                        date: cairoNow().date,
                        requiresMember: settings.qrRequiresMember,
                    });
                    if (!qrAccepted) {
                        await this.repo.writeAudit(callerId, AuditEvent.OUT_OF_RANGE, { qr: 'invalid' });
                        throw new AttendanceRefused(refuse(422, AttendanceRefusalReason.QR_INVALID));
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
            if (gates.audit)
                await this.repo.writeAudit(callerId, gates.audit.event, gates.audit.detail);
            if (gates.refusal)
                throw new AttendanceRefused(gates.refusal);
            const distance = gates.distance;
            const snapshot = bypassSnapshot(bypass);
            const ctx = {
                settings,
                minutesOfDay,
                defaults: { shift_start: settings.shiftStart, shift_end: settings.shiftEnd },
            };
            const nowIso = effectiveNow.toISOString();
            const todayAttendance = await this.repo.attendanceOn(member.id, date);
            if (payload.type === CheckType.CHECK_IN) {
                const rostered = await this.repo.rosteredShifts(member.id, date);
                const decision = decideCheckIn(rostered, todayAttendance, ctx);
                if (!decision.ok) {
                    const audit = decision.refusal.detail?.audit;
                    if (typeof audit === 'string') {
                        await this.repo.writeAudit(callerId, audit, { type: CheckType.CHECK_IN });
                    }
                    throw new AttendanceRefused(decision.refusal);
                }
                const { shift, status } = decision.value;
                const probePath = await this.storeProbe(payload, settings.storeProbeImages, callerId, member.id, date, shift.id);
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
                if (!written)
                    throw new AttendanceRefused(refuse(409, AttendanceRefusalReason.ALREADY_CHECKED_IN));
                await this.repo.writeAudit(callerId, AuditEvent.CHECK_IN, { date, status, distance, shift: shift.name });
                return { ok: true, type: CheckType.CHECK_IN, status, distance, shift: shift.name };
            }
            const yDate = previousDate(date);
            const toOpen = (records, d) => records.filter((a) => a.checkInAt && !a.checkOutAt).map((record) => ({ record, date: d }));
            const decision = decideCheckOut(toOpen(todayAttendance, date), toOpen(await this.repo.attendanceOn(member.id, yDate), yDate), ctx, bypass);
            if (!decision.ok) {
                const audit = decision.refusal.detail?.audit;
                if (typeof audit === 'string') {
                    await this.repo.writeAudit(callerId, audit, { type: CheckType.CHECK_OUT });
                }
                throw new AttendanceRefused(decision.refusal);
            }
            const out = decision.value;
            const probePath = await this.storeProbe(payload, settings.storeProbeImages, callerId, member.id, date, out.record.shiftId ?? 'x');
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
            await this.repo.writeAudit(callerId, AuditEvent.CHECK_OUT, { date: out.date, status: out.record.status, distance });
            return { ok: true, type: CheckType.CHECK_OUT, status: out.record.status, distance, shift: out.shift?.name ?? null };
        });
    }
    async setAttendanceManually(caller, input) {
        return this.uow.asCaller(caller, async () => {
            const scope = await scopeOf(this.repo.db, caller);
            const member = await this.repo.getMemberBranch(input.memberId);
            if (!member)
                throw notFound('member_not_found');
            if (scope.kind !== 'all') {
                const unit = { branchId: member.branchId, groupId: member.groupId };
                if (!coversUnit(scope, unit))
                    throw notFound('member_not_found');
            }
            if (input.clear) {
                await this.repo.manualClear(input.memberId, input.date, input.shiftId);
                return { ok: true, cleared: true };
            }
            const resolved = await this.repo.manualSetShift(input.memberId, input.date, input.shiftId);
            const shiftId = resolved.shift_id ?? null;
            const came = input.status !== AttendanceStatus.ABSENT;
            await this.repo.manualUpsert({
                memberId: input.memberId,
                branchId: member.branchId,
                date: input.date,
                status: input.status,
                shiftId,
                shiftName: resolved.shift_name,
                came,
            });
            return { ok: true };
        });
    }
};
AttendanceService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        AttendanceRepository,
        FileManager])
], AttendanceService);
export { AttendanceService };
//# sourceMappingURL=attendance.service.js.map