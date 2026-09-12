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
import { AuditRepository } from '../audit/audit.repository.js';
import { GenericRepository } from '../../infrastructure/database/generic.repository.js';
import { attendance, members, branches, groups, appSettings, qrTokens, rosterDays, shifts, memberDirectory, faceTemplates, } from '../../infrastructure/database/schema/index.js';
import { eq, and, or, gt, isNull, isNotNull, } from 'drizzle-orm';
import { cosineSimilarity, isEmbedding } from '../../domain/face/similarity.js';
import { evaluateGeofence } from '../../domain/attendance/geofence.js';
let AttendanceRepository = class AttendanceRepository extends GenericRepository {
    auditRepo;
    constructor(auditRepo) {
        super(attendance, attendance.id);
        this.auditRepo = auditRepo;
    }
    async loadMemberContext(profileId) {
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
        if (!r)
            return null;
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
    /**
     * The settings the check-in rules need. Columns are enumerated rather than
     * `select *` so that master_password_hash is never pulled into the process —
     * see SettingsRepository.getSettings() for why that is not left to the mapper.
     */
    async loadSettings() {
        const rows = await this.db
            .select({
            id: appSettings.id,
            checkinMethod: appSettings.checkinMethod,
            enforceShiftWindow: appSettings.enforceShiftWindow,
            bypassCheckoutWindow: appSettings.bypassCheckoutWindow,
            bypassFace: appSettings.bypassFace,
            bypassLocation: appSettings.bypassLocation,
            livenessRequired: appSettings.livenessRequired,
            requirePlayIntegrity: appSettings.requirePlayIntegrity,
            faceMatchThreshold: appSettings.faceMatchThreshold,
            maxAccuracyMeters: appSettings.maxAccuracyMeters,
            qrRequiresMember: appSettings.qrRequiresMember,
            storeProbeImages: appSettings.storeProbeImages,
            shiftStart: appSettings.shiftStart,
            shiftEnd: appSettings.shiftEnd,
            lateGraceMinutes: appSettings.lateGraceMinutes,
            defaultRadiusMeters: appSettings.defaultRadiusMeters,
            qrValiditySeconds: appSettings.qrValiditySeconds,
            qrBypassMinutes: appSettings.qrBypassMinutes,
            qrAllowImage: appSettings.qrAllowImage,
            allowCheckoutOnly: appSettings.allowCheckoutOnly,
            autoLeaveWork: appSettings.autoLeaveWork,
            locationIpMaxKm: appSettings.locationIpMaxKm,
            webDetectFrozenGps: appSettings.webDetectFrozenGps,
            blockDevOptions: appSettings.blockDevOptions,
            storeFaceImages: appSettings.storeFaceImages,
            captureHoldSeconds: appSettings.captureHoldSeconds,
            livenessMode: appSettings.livenessMode,
        })
            .from(appSettings)
            .where(eq(appSettings.id, 1))
            .limit(1);
        const s = rows[0];
        if (!s)
            return null;
        return {
            checkinMethod: s.checkinMethod || 'both',
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
    /**
     * Claim a QR token, if it is still claimable.
     *
     * TWO STATEMENTS, ONE TRANSACTION
     *
     * A locking SELECT followed by an UPDATE, which is safe here and only here:
     * `this.db` IS the request's transaction, and `FOR UPDATE SKIP LOCKED` holds
     * the row lock until that transaction commits. Two concurrent redemptions of
     * the same single-use token cannot both win — the second skips the locked row
     * and finds nothing.
     *
     * It would NOT be equivalent outside a transaction, where the lock would be
     * released the instant the select returned. Every caller reaches this through
     * UnitOfWorkService, so that case cannot arise.
     */
    async redeemQrToken(args) {
        const conditions = [
            eq(qrTokens.token, args.token),
            eq(qrTokens.branchId, args.branchId),
            eq(qrTokens.date, args.date),
            gt(qrTokens.expiresAt, new Date().toISOString()),
            // A single-use token that has been used is spent; a reusable one never is.
            or(eq(qrTokens.singleUse, false), isNull(qrTokens.usedAt)),
            // A token issued TO someone is only theirs. An open token is anyone's.
            or(isNull(qrTokens.memberId), eq(qrTokens.memberId, args.memberId)),
        ];
        // The setting that refuses open tokens outright.
        if (args.requiresMember)
            conditions.push(isNotNull(qrTokens.memberId));
        const candidates = await this.db
            .select({ id: qrTokens.id, singleUse: qrTokens.singleUse })
            .from(qrTokens)
            .where(and(...conditions))
            .limit(1)
            .for('update', { skipLocked: true });
        const claimed = candidates[0];
        if (!claimed)
            return false;
        if (claimed.singleUse) {
            await this.db
                .update(qrTokens)
                .set({ usedAt: new Date().toISOString() })
                .where(eq(qrTokens.id, claimed.id));
        }
        return true;
    }
    /**
     * Recompute the face match on the server, from the stored template.
     *
     * WHY THIS EXISTS
     *
     * The client computed the similarity and sent the NUMBER. The server compared
     * that number to the threshold and let the check-in through — so anything
     * that could post the request could post `face_score: 0.99` and walk past the
     * face gate entirely. The biometric was, in effect, advisory.
     *
     * The client sends the probe EMBEDDING, not a score, and the comparison is
     * made here against the enrolled template — the one copy an attacker cannot
     * substitute. A score computed on the device is a number the device chose.
     *
     * One member's template, selected by member_id: a verification, not a search.
     * The arithmetic is src/domain/face/similarity.ts.
     *
     * Returns null when the member has no enrolled template, when the stored
     * template is the wrong length, or when either vector is degenerate — the
     * caller must treat all of them as "cannot verify", never as "passed".
     */
    async verifyFaceScore(memberId, embedding) {
        // The probe comes off an HTTP body, so its shape is not guaranteed by
        // anything upstream. Refusing here keeps a bad one out of the arithmetic.
        if (!isEmbedding(embedding))
            return null;
        const rows = await this.db
            .select({ embedding: faceTemplates.embedding })
            .from(faceTemplates)
            .where(eq(faceTemplates.memberId, memberId))
            .limit(1);
        const template = rows[0]?.embedding;
        if (!template)
            return null;
        return cosineSimilarity(template, embedding);
    }
    /**
     * Where the caller is, relative to their branch.
     *
     * Reads the branch and hands it to domain/attendance/geofence.ts, which does
     * the maths.
     *
     * AUTHORITATIVE because of where the numbers come from: the branch centre,
     * radius and polygon are read from the row here, never accepted from the
     * client. Only the caller's own position is theirs to supply.
     *
     * null means the branch does not exist, which checkGates answers with a 500 —
     * the same thing the SQL function returning no rows did.
     */
    async geofenceCheck(branchId, lat, lng) {
        const rows = await this.db
            .select({
            latitude: branches.latitude,
            longitude: branches.longitude,
            radiusMeters: branches.radiusMeters,
            areaCoords: branches.areaCoords,
        })
            .from(branches)
            .where(eq(branches.id, branchId))
            .limit(1);
        const branch = rows[0];
        return branch ? evaluateGeofence(branch, { lat, lng }) : null;
    }
    async rosteredShifts(memberId, date) {
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
    async attendanceOn(memberId, date) {
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
            } : null,
        }));
    }
    /**
     * Record a check-in. Returns false if there already was one.
     *
     * THE `setWhere` IS THE WHOLE SAFETY PROPERTY
     *
     * A member who taps twice must not overwrite their own arrival time — the
     * second tap would move a LATE check-in forward and erase the evidence. The
     * upsert therefore only updates a row that has no `check_in_at` yet, and
     * returning nothing is how the caller learns this was a repeat tap.
     *
     * `setWhere` refers to the row already in the table, `excluded` to the one
     * being inserted; Drizzle renders both, so this needed no raw statement.
     */
    async writeCheckIn(w) {
        const values = {
            memberId: w.memberId,
            branchId: w.branchId,
            date: w.date,
            status: w.status,
            shiftId: w.shiftId,
            shiftName: w.shiftName,
            checkInAt: w.atIso,
            checkInLat: w.lat,
            checkInLng: w.lng,
            checkInAccuracyM: w.accuracy,
            checkInDistanceM: w.distance,
            checkInFaceScore: w.faceScore,
            checkInLivenessPassed: w.livenessPassed,
            checkInIsMock: w.isMock,
            checkInProbePath: w.probePath,
            checkInBypass: w.bypass ?? null,
        };
        const rows = await this.db
            .insert(attendance)
            .values(values)
            .onConflictDoUpdate({
            target: [attendance.memberId, attendance.date, attendance.shiftId],
            // Everything except member/branch/date, which are the conflict key.
            set: {
                status: values.status,
                shiftName: values.shiftName,
                checkInAt: values.checkInAt,
                checkInLat: values.checkInLat,
                checkInLng: values.checkInLng,
                checkInAccuracyM: values.checkInAccuracyM,
                checkInDistanceM: values.checkInDistanceM,
                checkInFaceScore: values.checkInFaceScore,
                checkInLivenessPassed: values.checkInLivenessPassed,
                checkInIsMock: values.checkInIsMock,
                checkInProbePath: values.checkInProbePath,
                checkInBypass: values.checkInBypass,
            },
            setWhere: isNull(attendance.checkInAt),
        })
            .returning({ id: attendance.id });
        return rows.length > 0;
    }
    async writeCheckOut(w) {
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
    /**
     * The names that go into a probe's path. See infrastructure/storage/paths.ts:
     * the tree is meant to be readable by someone browsing the directory, so the
     * branch is fetched even though nothing else here needs it.
     */
    async probeNaming(profileId) {
        const rows = await this.db
            .select({
            group_year: memberDirectory.groupYear,
            member_code: memberDirectory.memberCode,
            national_id: memberDirectory.nationalId,
            branch_name: memberDirectory.branchName,
        })
            .from(memberDirectory)
            .where(eq(memberDirectory.profileId, profileId))
            .limit(1);
        const r = rows[0];
        if (!r)
            return null;
        return {
            groupYear: r.group_year,
            code: r.member_code ?? r.national_id,
            branchName: r.branch_name,
        };
    }
    /** Delegates to the one writer. See AuditRepository.record(). */
    async writeAudit(actorId, event, detail) {
        await this.auditRepo.record(actorId, event, detail);
    }
    async manualClear(memberId, date, shiftId) {
        const conditions = [
            eq(attendance.memberId, memberId),
            eq(attendance.date, date),
        ];
        if (shiftId)
            conditions.push(eq(attendance.shiftId, shiftId));
        await this.db.delete(attendance).where(and(...conditions));
    }
    async getMemberBranch(memberId) {
        const rows = await this.db.select({ branchId: members.branchId, groupId: members.groupId }).from(members).where(eq(members.id, memberId)).limit(1);
        return rows[0] ?? null;
    }
    /**
     * Which shift a manual edit applies to, and what it is called.
     *
     * Three sources in order of authority: what the admin picked, the shift the
     * member already has an attendance row for that day, then what the roster says
     * they were expected on. The old version was one `coalesce()` over two
     * scalar subqueries, which reads compactly and hides that the second and third
     * are only evaluated when the ones before them come back null — the ordering
     * IS the rule, and it is worth seeing.
     *
     * Falling through all three leaves a null shift, which is legal: an admin may
     * mark someone present on a day the roster never put them on.
     */
    async manualSetShift(memberId, date, shiftId) {
        let resolved = shiftId;
        if (!resolved) {
            const rows = await this.db
                .select({ shiftId: attendance.shiftId, checkInAt: attendance.checkInAt })
                .from(attendance)
                .where(and(eq(attendance.memberId, memberId), eq(attendance.date, date)));
            // Was `order by check_in_at nulls last limit 1`: the earliest arrival
            // wins, and a row nobody checked into only wins if it is all there is.
            const checkedIn = rows
                .filter((r) => r.checkInAt)
                .sort((a, b) => a.checkInAt.localeCompare(b.checkInAt));
            resolved = (checkedIn[0] ?? rows[0])?.shiftId ?? null;
        }
        if (!resolved) {
            const rows = await this.db
                .select({ shiftId: rosterDays.shiftId })
                .from(rosterDays)
                .where(and(eq(rosterDays.memberId, memberId), eq(rosterDays.date, date)))
                .limit(1);
            resolved = rows[0]?.shiftId ?? null;
        }
        if (!resolved)
            return { shift_id: null, shift_name: null };
        const named = await this.db
            .select({ name: shifts.name })
            .from(shifts)
            .where(eq(shifts.id, resolved))
            .limit(1);
        return { shift_id: resolved, shift_name: named[0]?.name ?? null };
    }
    /**
     * Write one imported slot — the whole record, times included.
     *
     * Like manualUpsert this overwrites without a `setWhere`: an import is an
     * admin's correction of the record, and it may replace what a device wrote.
     * Every device-only field (location, face score, probe) is cleared, because
     * this arrival did not come from a device; `is_mock` is pinned false.
     */
    async importUpsert(w) {
        const set = {
            status: w.status,
            shiftName: w.shiftName,
            checkInAt: w.checkInAt,
            checkInLat: null,
            checkInLng: null,
            checkInAccuracyM: null,
            checkInDistanceM: null,
            checkInFaceScore: null,
            checkInLivenessPassed: w.checkInAt !== null,
            checkInIsMock: false,
            checkInProbePath: null,
            checkOutAt: w.checkOutAt,
            checkOutLat: null,
            checkOutLng: null,
            checkOutAccuracyM: null,
            checkOutDistanceM: null,
            checkOutFaceScore: null,
            checkOutLivenessPassed: w.checkOutAt !== null ? true : null,
            checkOutIsMock: w.checkOutAt !== null ? false : null,
            checkOutProbePath: null,
            checkoutStatus: w.checkoutStatus,
        };
        await this.db
            .insert(attendance)
            .values({ memberId: w.memberId, branchId: w.branchId, date: w.date, shiftId: w.shiftId, ...set })
            .onConflictDoUpdate({ target: [attendance.memberId, attendance.date, attendance.shiftId], set });
    }
    async manualUpsert(w) {
        // Unlike writeCheckIn there is no `setWhere` here, and that is the point: an
        // admin correcting a record is allowed to overwrite a check-in. `is_mock` is
        // pinned false because this arrival did not come from a device at all.
        const set = {
            status: w.status,
            shiftName: w.shiftName,
            checkInAt: w.came ? new Date().toISOString() : null,
            checkInIsMock: false,
            checkInLivenessPassed: w.came,
        };
        await this.db
            .insert(attendance)
            .values({
            memberId: w.memberId,
            branchId: w.branchId,
            date: w.date,
            shiftId: w.shiftId,
            ...set,
        })
            .onConflictDoUpdate({
            target: [attendance.memberId, attendance.date, attendance.shiftId],
            set,
        });
    }
};
AttendanceRepository = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [AuditRepository])
], AttendanceRepository);
export { AttendanceRepository };
//# sourceMappingURL=attendance.repository.js.map