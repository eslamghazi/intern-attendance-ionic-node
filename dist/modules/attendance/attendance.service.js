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
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { AttendanceRepository } from './attendance.repository.js';
import { cairoNow } from '../../domain/clock.js';
import { previousDate } from '../../domain/attendance/windows.js';
import { bypassSnapshot, checkGates, resolveBypass } from '../../domain/attendance/gates.js';
import { decideCheckIn, decideCheckOut } from '../../domain/attendance/slot.js';
import { importedSlot, parseClock } from '../../domain/attendance/imported.js';
import { refuse, } from '../../domain/attendance/types.js';
import { notFound } from '../../common/errors.js';
import { scopeOf } from '../../common/auth/access.service.js';
import { coversUnit } from '../../domain/access/scope.js';
import { FileManager } from '../../infrastructure/storage/file-manager.service.js';
import { probePath } from '../../infrastructure/storage/paths.js';
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
    /**
     * Keep the capture taken at this check-in or check-out.
     *
     * The path is built by infrastructure/storage/paths.ts and is meant to be
     * legible to someone browsing the directory over SFTP, because that is what
     * actually happens when a student disputes a record:
     *
     *   probes/year-2026/2026-09/2026-09-11/branch-el-mabarra/
     *     member-2026010001/check-in__07-58__morning-shift.jpg
     *
     * The old name was `2026/2026010001/2026-09-11-<shift-uuid>-check_in.jpg`:
     * the shift was a raw UUID, the year appeared twice, nothing named the
     * branch, and every member's captures piled into one directory that only ever
     * grew.
     *
     * Failing to store a probe must never fail the check-in — the attendance
     * record is the thing that matters and the image is corroboration — so the
     * catch returns the path the client sent and lets the check-in stand.
     */
    async storeProbe(payload, keep, profileId, memberId, date, shiftName) {
        if (!keep || !payload.probeBase64)
            return payload.probePath;
        try {
            const bytes = this.fileManager.decodeBase64Image(payload.probeBase64);
            if (!bytes)
                return payload.probePath;
            const naming = await this.repo.probeNaming(profileId);
            const path = probePath({
                date,
                branchName: naming?.branchName ?? null,
                memberCode: naming?.code ?? memberId,
                shiftName,
                type: payload.type,
            });
            await this.fileManager.upload({
                kind: 'probes',
                path,
                body: bytes,
                contentType: 'image/jpeg',
                owner: profileId,
                // The capture is OF this member, which is what decides who may read it.
                subject: profileId,
            });
            return path;
        }
        catch {
            return payload.probePath;
        }
    }
    async recordAttendance(callerId, payload) {
        return this.uow.transaction(async () => {
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
            // THE FACE SCORE IS THE SERVER'S. THERE IS NO CLIENT FALLBACK.
            //
            // The client used to send the similarity as a number and the gate
            // compared that number to the threshold — so anything that could post the
            // request could post 0.99 and walk past the face gate. The client already
            // had the vector that produced its score (bestSimilarity returns it); it
            // simply never sent it.
            //
            // It sends it now, and the score is recomputed here against the enrolled
            // template — the one copy an attacker cannot substitute. `payload.faceScore`
            // is never read by the gate again.
            //
            // A client that does not send an embedding is REFUSED rather than
            // believed. Accepting its number "until the phones update" would leave
            // the hole open with a deadline nobody owns, and the refusal is specific
            // enough to act on.
            let checked = payload;
            if (!bypass.face) {
                if (!payload.probeEmbedding) {
                    throw new AttendanceRefused(refuse(422, AttendanceRefusalReason.FACE_REQUIRED));
                }
                const verified = await this.repo.verifyFaceScore(member.id, payload.probeEmbedding);
                if (verified === null) {
                    // No enrolled template to compare against. checkGates refuses this as
                    // NOT_ENROLLED; reaching here means the template vanished between the
                    // two reads, which is a server problem, not the member's.
                    throw new AttendanceRefused(refuse(500, AttendanceRefusalReason.FACE_REQUIRED));
                }
                checked = { ...payload, faceScore: verified };
            }
            const gates = checkGates(checked, settings, bypass, member, geofence);
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
                const storedProbePath = await this.storeProbe(payload, settings.storeProbeImages, callerId, member.id, date, shift.name);
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
                    faceScore: checked.faceScore,
                    livenessPassed: payload.livenessPassed,
                    isMock: payload.isMock,
                    probePath: storedProbePath,
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
            const storedProbePath = await this.storeProbe(payload, settings.storeProbeImages, callerId, member.id, date, out.shift?.name ?? null);
            await this.repo.writeCheckOut({
                id: out.record.id,
                checkoutStatus: out.checkoutStatus,
                atIso: nowIso,
                lat: payload.lat,
                lng: payload.lng,
                accuracy: payload.accuracy,
                distance,
                faceScore: checked.faceScore,
                livenessPassed: payload.livenessPassed,
                isMock: payload.isMock,
                probePath: storedProbePath,
                bypass: snapshot,
            });
            await this.repo.writeAudit(callerId, AuditEvent.CHECK_OUT, { date: out.date, status: out.record.status, distance });
            return { ok: true, type: CheckType.CHECK_OUT, status: out.record.status, distance, shift: out.shift?.name ?? null };
        });
    }
    /**
     * Attendance from a file — typed in after the fact, or alongside a roster.
     *
     * THE ONE RULE: a row is written onto a rostered (member, date, shift) or
     * not at all. Nothing here creates a roster; a slot the roster does not
     * have is reported as `no_roster` and skipped. Everything else follows the
     * live path: the caller's reach decides which members are theirs, and the
     * shift's own windows decide late and early leave (domain/attendance/
     * imported.ts). A row is reported by its index so the file can say which
     * lines did not land, and one audit row records the whole import.
     */
    async importAttendance(caller, rows) {
        return this.uow.transaction(async () => {
            const scope = await scopeOf(this.repo.db, caller);
            const settings = await this.repo.loadSettings();
            const defaults = { shift_start: settings?.shiftStart ?? null, shift_end: settings?.shiftEnd ?? null };
            const result = { written: 0, no_roster: 0, not_yours: 0, invalid: 0, rows: [] };
            const memberCache = new Map();
            for (const [index, row] of rows.entries()) {
                const outcome = async () => {
                    if (row.checkIn && parseClock(row.checkIn) === null)
                        return 'invalid';
                    if (row.checkOut && parseClock(row.checkOut) === null)
                        return 'invalid';
                    if (!memberCache.has(row.memberId))
                        memberCache.set(row.memberId, await this.repo.getMemberBranch(row.memberId));
                    const member = memberCache.get(row.memberId);
                    if (!member)
                        return 'not_yours';
                    if (scope.kind !== 'all' && !coversUnit(scope, { branchId: member.branchId, groupId: member.groupId })) {
                        return 'not_yours';
                    }
                    const shift = (await this.repo.rosteredShifts(row.memberId, row.date)).find((s) => s.id === row.shiftId);
                    if (!shift)
                        return 'no_roster';
                    const slot = importedSlot(shift, row.date, { checkIn: row.checkIn, checkOut: row.checkOut }, defaults);
                    await this.repo.importUpsert({
                        memberId: row.memberId,
                        branchId: member.branchId,
                        date: row.date,
                        shiftId: shift.id,
                        shiftName: shift.name,
                        ...slot,
                    });
                    return 'written';
                };
                const o = await outcome();
                result[o] += 1;
                result.rows.push({ index, outcome: o });
            }
            await this.repo.writeAudit(caller.id, AuditEvent.ATTENDANCE_IMPORTED, {
                rows: rows.length,
                written: result.written,
                no_roster: result.no_roster,
                not_yours: result.not_yours,
                invalid: result.invalid,
            });
            return result;
        });
    }
    async setAttendanceManually(caller, input) {
        return this.uow.transaction(async () => {
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