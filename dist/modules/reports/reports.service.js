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
import { attendanceOutcome } from '../../domain/attendance/outcome.js';
import { daysInMonth } from '../../domain/report/matrix.js';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { ReportsRepository } from './reports.repository.js';
import { requireSelfOrMember, scopeFilter, scopeOf, } from '../../common/auth/access.service.js';
import { coversUnit } from '../../domain/access/scope.js';
import { monthBounds } from '../../domain/member/filter.js';
import { monthStats } from '../../domain/report/rate.js';
import { AttendanceStatus, CheckoutStatus } from '../../common/enums/index.js';
let ReportsService = class ReportsService {
    uow;
    repo;
    constructor(uow, repo) {
        this.uow = uow;
        this.repo = repo;
    }
    /**
     * Narrow rows to what this caller may see.
     *
     * For the two views that take no branch parameter at all — "who is present
     * right now", and today's board. They cannot be REFUSED for naming nothing,
     * because naming nothing is their whole shape; so the answer is narrowed
     * instead. A superadmin sees the faculty, an assigned admin sees their own
     * branches and groups, and a row that belongs to neither is simply not there.
     */
    async narrowToScope(tx, caller, rows, unitOf) {
        const scope = await scopeOf(tx, caller);
        if (scope.kind === 'all')
            return rows;
        if (scope.kind === 'none')
            return [];
        return rows.filter((r) => coversUnit(scope, unitOf(r)));
    }
    async getPresent(caller, dates) {
        return this.uow.transaction(async (tx) => {
            const rows = await this.repo.getPresent(dates);
            return this.narrowToScope(tx, caller, rows, (r) => ({
                branchId: r.branch_id ?? null,
                groupId: r.group_id ?? null,
            }));
        });
    }
    async getReview(caller, date, branchId) {
        return this.uow.transaction(async (tx) => {
            // NARROWED, not refused. An admin assigned to two branches sees both, and
            // a screen that opens with no branch chosen shows their reach rather than
            // a 403. The scope is pushed into the SQL so counts and aggregates agree
            // with the rows beside them.
            const reach = await scopeFilter(tx, caller);
            const rows = await this.repo.getReview(date, branchId, reach);
            return rows.map((r) => ({
                ...r.attendance,
                member: {
                    profile: {
                        full_name: r.profile_full_name,
                        national_id: r.profile_national_id,
                    },
                },
            }));
        });
    }
    async getDetail(caller, memberId, date, shiftId) {
        return this.uow.transaction(async (tx) => {
            // A member may ask about THEMSELVES. Staff go through their assignments.
            // Without this the member_id in the request was simply believed, so any
            // member could read any other member's record by changing it.
            await requireSelfOrMember(tx, caller, memberId);
            const r = await this.repo.getDetail(memberId, date, shiftId);
            if (!r)
                return null;
            return {
                ...r.attendance,
                member: {
                    profile: {
                        full_name: r.profile_full_name,
                        national_id: r.profile_national_id,
                    },
                },
            };
        });
    }
    async getHistory(caller, memberId, year, month) {
        return this.uow.transaction(async (tx) => {
            // A member may ask about THEMSELVES. Staff go through their assignments.
            // Without this the member_id in the request was simply believed, so any
            // member could read any other member's record by changing it.
            await requireSelfOrMember(tx, caller, memberId);
            if (!year || !month) {
                const rows = await this.repo.getAttendanceHistorySimple(memberId);
                return rows.map((r) => ({
                    id: String(r.id),
                    date: r.date,
                    shift_id: r.shift_id,
                    shift_name: r.shift_name,
                    status: r.check_in_at === null ? AttendanceStatus.ABSENT : r.status === AttendanceStatus.LATE ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
                    check_in_at: r.check_in_at,
                    check_out_at: r.check_out_at,
                    checkout_status: r.checkout_status,
                    outcome: attendanceOutcome({
                        hasRoster: true,
                        concluded: true,
                        checkInAt: r.check_in_at,
                        checkInStatus: r.status,
                        checkOutAt: r.check_out_at,
                        checkoutStatus: r.checkout_status,
                    }),
                }));
            }
            const { first, last } = monthBounds(year, month);
            const rosterRows = await this.repo.getRosterBetween(memberId, first, last);
            const attRows = await this.repo.getAttendanceBetween(memberId, first, last);
            const items = [];
            const rosterMap = new Map();
            for (const r of rosterRows) {
                const key = `${r.date}_${r.shift_id ?? 'null'}`;
                rosterMap.set(key, r);
                const a = attRows.find((att) => att.date === r.date && att.shiftId === r.shift_id);
                let status = 'pending';
                if (a && a.checkInAt) {
                    status = a.status === AttendanceStatus.LATE ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
                }
                else if (r.done) {
                    status = AttendanceStatus.ABSENT;
                }
                items.push({
                    id: a ? String(a.id) : `roster:${r.date}|${r.shift_id ?? ''}`,
                    date: r.date,
                    shift_id: r.shift_id,
                    shift_name: a?.shiftName ?? r.shift_name,
                    status,
                    check_in_at: a?.checkInAt ?? null,
                    check_out_at: a?.checkOutAt ?? null,
                    checkout_status: a?.checkoutStatus ?? null,
                });
            }
            for (const a of attRows) {
                const key = `${a.date}_${a.shiftId ?? 'null'}`;
                if (!rosterMap.has(key)) {
                    items.push({
                        id: String(a.id),
                        date: a.date,
                        shift_id: a.shiftId,
                        shift_name: a.shiftName,
                        status: a.checkInAt === null ? AttendanceStatus.ABSENT : a.status === AttendanceStatus.LATE ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
                        check_in_at: a.checkInAt,
                        check_out_at: a.checkOutAt,
                        checkout_status: a.checkoutStatus,
                    });
                }
            }
            // EVERY DAY OF THE MONTH, not only the ones with a row.
            //
            // A member reading their own history needs to see the days they were off
            // as well as the days they were expected — otherwise a gap in the list is
            // ambiguous: was I not rostered, or did the record go missing? An `off`
            // day says which, and it costs nothing to say.
            const withRows = new Set(items.map((i) => i.date));
            const days = daysInMonth(year, month);
            for (let d = 1; d <= days; d++) {
                const date = `${first.slice(0, 8)}${String(d).padStart(2, '0')}`;
                if (withRows.has(date))
                    continue;
                items.push({
                    id: `off:${date}`,
                    date,
                    shift_id: null,
                    shift_name: null,
                    status: 'off',
                    check_in_at: null,
                    check_out_at: null,
                    checkout_status: null,
                });
            }
            // One combined outcome per slot, so the screen and the exports render the
            // same vocabulary instead of each pairing the two axes their own way.
            // Mapped rather than assigned onto the rows: a row is not an entry until
            // it has one, and the types now say so.
            const entries = items.map((item) => ({
                ...item,
                outcome: attendanceOutcome({
                    hasRoster: item.status !== 'off',
                    concluded: item.status !== 'pending',
                    checkInAt: item.check_in_at,
                    checkInStatus: item.status,
                    checkOutAt: item.check_out_at,
                    checkoutStatus: item.checkout_status,
                }),
            }));
            entries.sort((a, b) => {
                if (a.date !== b.date)
                    return b.date.localeCompare(a.date);
                return (a.shift_name ?? '').localeCompare(b.shift_name ?? '');
            });
            return entries;
        });
    }
    async getDay(caller, memberId, date) {
        return this.uow.transaction(async (tx) => {
            // A member may ask about THEMSELVES. Staff go through their assignments.
            // Without this the member_id in the request was simply believed, so any
            // member could read any other member's record by changing it.
            await requireSelfOrMember(tx, caller, memberId);
            const rosterShifts = await this.repo.getRosterDayWithShift(memberId, date);
            const atts = await this.repo.getAttendanceDayWithShift(memberId, date);
            return {
                shifts: rosterShifts.map(r => ({
                    id: r.shift.id,
                    name: r.shift.name,
                    key: r.shift.key,
                    start_time: r.shift.startTime,
                    end_time: r.shift.endTime,
                    checkin_open: r.shift.checkinOpen,
                    checkin_late: r.shift.checkinLate,
                    checkin_close: r.shift.checkinClose,
                    checkout_open: r.shift.checkoutOpen,
                    checkout_close: r.shift.checkoutClose,
                })),
                attendance: atts.map(a => ({
                    id: a.id,
                    date: a.date,
                    shift_id: a.shift_id,
                    shift_name: a.shift_name,
                    status: a.status,
                    check_in_at: a.check_in_at,
                    check_out_at: a.check_out_at,
                    shift: a.shift ? {
                        id: a.shift.id,
                        name: a.shift.name,
                        key: a.shift.key,
                        start_time: a.shift.startTime,
                        end_time: a.shift.endTime,
                        checkin_open: a.shift.checkinOpen,
                        checkin_late: a.shift.checkinLate,
                        checkin_close: a.shift.checkinClose,
                        checkout_open: a.shift.checkoutOpen,
                        checkout_close: a.shift.checkoutClose,
                    } : null,
                })),
            };
        });
    }
    async getDailyRoster(caller, date, branchId) {
        return this.uow.transaction(async (tx) => {
            // NARROWED, not refused. An admin assigned to two branches sees both, and
            // a screen that opens with no branch chosen shows their reach rather than
            // a 403. The scope is pushed into the SQL so counts and aggregates agree
            // with the rows beside them.
            const reach = await scopeFilter(tx, caller);
            const expected = await this.repo.getDailyExpected(date, branchId, reach);
            const att = await this.repo.getDailyAttendance(date, branchId, reach);
            const peopleMap = new Map();
            for (const e of expected) {
                const key = `${e.member_id}_${e.shift_id ?? 'null'}`;
                peopleMap.set(key, {
                    member_id: e.member_id,
                    full_name: e.full_name,
                    national_id: e.national_id,
                    shift_id: e.shift_id,
                    shift: e.shift ? {
                        name: e.shift.name,
                        key: e.shift.key,
                        start_time: e.shift.startTime,
                        end_time: e.shift.endTime,
                    } : null,
                });
            }
            for (const a of att) {
                // Just append any attendance without expected roster as well
                // Wait, the SQL union adds atts without expected. We can just add them.
                const matches = expected.filter(e => e.member_id === a.member_id);
                if (matches.length === 0) {
                    peopleMap.set(`${a.member_id}_null`, {
                        member_id: a.member_id,
                        full_name: a.full_name,
                        national_id: a.national_id,
                        shift_id: null,
                        shift: null,
                        att: a,
                    });
                }
                else {
                    // Attach attendance to existing matched person slots
                    // (assuming 1 att per person for simplicity in this view or merging them)
                    for (const m of matches) {
                        const key = `${m.member_id}_${m.shift_id ?? 'null'}`;
                        peopleMap.get(key).att = a;
                    }
                }
            }
            const results = Array.from(peopleMap.values()).map(p => {
                const a = p.att;
                let status = 'pending';
                if (a && a.check_in_at !== null) {
                    status = a.status ?? AttendanceStatus.PRESENT;
                }
                else if (p.done) {
                    status = AttendanceStatus.ABSENT;
                }
                return {
                    member_id: p.member_id,
                    full_name: p.full_name,
                    national_id: p.national_id,
                    shift: p.shift,
                    check_in_at: a?.check_in_at ?? null,
                    check_out_at: a?.check_out_at ?? null,
                    status,
                };
            });
            results.sort((a, b) => {
                const rankA = a.check_in_at && a.status !== AttendanceStatus.LATE && a.status !== AttendanceStatus.EARLY_LEAVE ? 0
                    : a.check_in_at && a.status === AttendanceStatus.LATE ? 1
                        : a.check_in_at && a.status === AttendanceStatus.EARLY_LEAVE ? 2
                            : a.status === AttendanceStatus.ABSENT ? 4 : 3;
                const rankB = b.check_in_at && b.status !== AttendanceStatus.LATE && b.status !== AttendanceStatus.EARLY_LEAVE ? 0
                    : b.check_in_at && b.status === AttendanceStatus.LATE ? 1
                        : b.check_in_at && b.status === AttendanceStatus.EARLY_LEAVE ? 2
                            : b.status === AttendanceStatus.ABSENT ? 4 : 3;
                if (rankA !== rankB)
                    return rankA - rankB;
                return a.full_name.localeCompare(b.full_name);
            });
            return results;
        });
    }
    /**
     * The monthly attendance matrix, for an export: EVERY member the filter
     * matches, with no page.
     *
     * Delegates to the same builder as the paged read — `pageSize: null` is the
     * only difference — so the file cannot drift from the screen it came from.
     */
    async getMonthlyForExport(caller, filters, year, month) {
        return this.buildMonthly(caller, filters, year, month, null, 0);
    }
    async getMonthly(caller, filters, year, month, page, pageSize) {
        return this.buildMonthly(caller, filters, year, month, pageSize, (page - 1) * pageSize);
    }
    async buildMonthly(caller, filters, year, month, pageSize, offset) {
        const { first, last } = monthBounds(year, month);
        return this.uow.transaction(async (tx) => {
            // NARROWED, not refused. An admin assigned to two branches sees both, and
            // a screen that opens with no branch chosen shows their reach rather than
            // a 403 — while a branch they do not run simply is not in the answer.
            const scoped = { ...filters, scope: await scopeFilter(tx, caller) };
            const pageRows = await this.repo.getMemberDirectoryPage(scoped, year, month, pageSize, offset);
            const total = await this.repo.getMemberDirectoryCount(scoped, year, month);
            const memberIds = pageRows.map(r => r.member_id).filter(Boolean);
            const rosterRows = await this.repo.getRosterForMembersBetween(memberIds, first, last);
            const attRows = await this.repo.getAttendanceForMembersBetween(memberIds, first, last);
            const results = pageRows.map(p => {
                const days = {};
                const checkouts = {};
                const mRoster = rosterRows.filter(r => r.member_id === p.member_id);
                const mAtt = attRows.filter(a => a.member_id === p.member_id);
                const slotsMap = new Map();
                for (const r of mRoster) {
                    const key = `${r.date}_${r.shift_id ?? 'null'}`;
                    const a = mAtt.find(att => att.date === r.date && att.shift_id === r.shift_id);
                    let in_status = 'pending';
                    if (a && a.check_in_at) {
                        in_status = a.status === AttendanceStatus.LATE ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
                    }
                    else if (r.done) {
                        in_status = AttendanceStatus.ABSENT;
                    }
                    let out_status = null;
                    if (a && a.checkout_status)
                        out_status = a.checkout_status;
                    else if (a?.status === AttendanceStatus.LEFT_WORK)
                        out_status = CheckoutStatus.LEFT_WORK;
                    else if (a?.status === AttendanceStatus.EARLY_LEAVE)
                        out_status = CheckoutStatus.EARLY_LEAVE;
                    slotsMap.set(key, { in_status, out_status });
                }
                for (const a of mAtt) {
                    const key = `${a.date}_${a.shift_id ?? 'null'}`;
                    if (!slotsMap.has(key)) {
                        let in_status = a.status === AttendanceStatus.LATE ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
                        let out_status = null;
                        if (a.checkout_status)
                            out_status = a.checkout_status;
                        else if (a.status === AttendanceStatus.LEFT_WORK)
                            out_status = CheckoutStatus.LEFT_WORK;
                        else if (a.status === AttendanceStatus.EARLY_LEAVE)
                            out_status = CheckoutStatus.EARLY_LEAVE;
                        slotsMap.set(key, { in_status, out_status });
                    }
                }
                for (const [key, val] of slotsMap.entries()) {
                    const [dateStr, shiftStr] = key.split('_');
                    const day = String(new Date(dateStr).getDate());
                    if (!days[day]) {
                        days[day] = [];
                        checkouts[day] = [];
                    }
                    // The query ordered by shift_id implicitly but doing it via JSON is unordered
                    days[day].push(val.in_status);
                    checkouts[day].push(val.out_status);
                }
                return {
                    member_id: p.member_id,
                    full_name: p.full_name,
                    national_id: p.national_id,
                    total: String(total),
                    days,
                    checkouts,
                };
            });
            return {
                rows: results.map(({ total: _t, ...r }) => r),
                total,
            };
        });
    }
    async getReport(caller, from, to, branchId, groupId) {
        return this.uow.transaction(async (tx) => {
            // NARROWED, not refused. An admin assigned to two branches sees both, and
            // a screen that opens with no branch chosen shows their reach rather than
            // a 403. The scope is pushed into the SQL so counts and aggregates agree
            // with the rows beside them.
            const reach = await scopeFilter(tx, caller);
            const rows = await this.repo.getReportAttendanceBetween(from, to, branchId, groupId, reach);
            return rows.map((r) => ({
                date: r.date,
                status: r.status,
                check_in_at: r.check_in_at,
                check_out_at: r.check_out_at,
                member: {
                    group_id: r.group_id,
                    profile: {
                        full_name: r.profile_full_name,
                        national_id: r.profile_national_id,
                    },
                    group: r.group_name ? { name: r.group_name } : null,
                    branch: r.branch_name ? { name: r.branch_name } : null,
                },
            }));
        });
    }
    async getToday(caller, date) {
        return this.uow.transaction(async (tx) => {
            const all = await this.repo.getTodayAttendance(date);
            const rows = await this.narrowToScope(tx, caller, all, (r) => ({
                branchId: r.branch_id ?? null,
                groupId: r.group_id ?? null,
            }));
            return rows.map((r) => ({
                status: r.status,
                check_in_at: r.check_in_at,
                branch_id: r.branch_id,
                member: {
                    group_id: r.group_id,
                },
            }));
        });
    }
    async getStats(caller, year, month, f) {
        const { first, last } = monthBounds(year, month);
        const daysInMonth = new Date(year, month, 0).getDate();
        return this.uow.transaction(async (tx) => {
            // NARROWED, not refused. An admin assigned to two branches sees both, and
            // a screen that opens with no branch chosen shows their reach rather than
            // a 403. The scope is pushed into the SQL so counts and aggregates agree
            // with the rows beside them.
            const reach = await scopeFilter(tx, caller);
            const atts = await this.repo.getStatsAttendance(first, last, f, reach);
            const rosters = await this.repo.getStatsRoster(first, last, f, reach);
            let attended = 0;
            let late = 0;
            let absent = 0;
            let pending = 0;
            let attendedOpen = 0;
            let attendedSettled = 0;
            const perBranchMap = new Map();
            const perGroupMap = new Map();
            const perShiftMap = new Map();
            const perBranchStatusMap = new Map();
            const perDayMap = new Map();
            for (let i = 1; i <= daysInMonth; i++) {
                perDayMap.set(i, { attended: 0, absent: 0, pending: 0, settled_att: 0, open_att: 0 });
            }
            const judged = new Set();
            for (const a of atts) {
                if (!a.check_in_at)
                    continue;
                attended++;
                if (a.status === AttendanceStatus.LATE)
                    late++;
                const day = new Date(String(a.date)).getDate();
                const dStat = perDayMap.get(day);
                if (dStat)
                    dStat.attended++;
                if (a.branch_id)
                    perBranchMap.set(a.branch_id, (perBranchMap.get(a.branch_id) || 0) + 1);
                if (a.group_id)
                    perGroupMap.set(a.group_id, (perGroupMap.get(a.group_id) || 0) + 1);
                if (a.shift_id)
                    perShiftMap.set(a.shift_id, (perShiftMap.get(a.shift_id) || 0) + 1);
                if (a.branch_id) {
                    const bs = perBranchStatusMap.get(a.branch_id) || { present: 0, late: 0, absent: 0 };
                    if (a.status === AttendanceStatus.LATE)
                        bs.late++;
                    else
                        bs.present++;
                    perBranchStatusMap.set(a.branch_id, bs);
                }
            }
            for (const r of rosters) {
                const key = `${r.member_id}_${r.date}_${r.shift_id ?? 'null'}`;
                if (judged.has(key))
                    continue;
                judged.add(key);
                const a = atts.find((att) => att.member_id === r.member_id && att.date === r.date && att.shift_id === r.shift_id);
                const came = a?.check_in_at != null;
                const done = r.done;
                const day = new Date(String(r.date)).getDate();
                const dStat = perDayMap.get(day);
                if (done && !came) {
                    absent++;
                    if (dStat)
                        dStat.absent++;
                    if (r.branch_id) {
                        const bs = perBranchStatusMap.get(r.branch_id) || { present: 0, late: 0, absent: 0 };
                        bs.absent++;
                        perBranchStatusMap.set(r.branch_id, bs);
                    }
                }
                else if (!done && !came) {
                    pending++;
                    if (dStat)
                        dStat.pending++;
                }
                else if (!done && came) {
                    attendedOpen++;
                    if (dStat)
                        dStat.open_att++;
                }
                else if (done && came) {
                    attendedSettled++;
                    if (dStat)
                        dStat.settled_att++;
                }
            }
            const perBranch = Array.from(perBranchMap.entries()).map(([k, v]) => ({ branch_id: k, value: v }));
            const perGroup = Array.from(perGroupMap.entries()).map(([k, v]) => ({ group_id: k, value: v }));
            const perShift = Array.from(perShiftMap.entries()).map(([k, v]) => ({ shift_id: k, value: v }));
            const perBranchStatus = Array.from(perBranchStatusMap.entries()).map(([k, v]) => ({
                branch_id: k,
                present: v.present,
                late: v.late,
                absent: v.absent,
            }));
            const perDay = Array.from(perDayMap.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([day, v]) => ({
                day,
                attended: v.attended,
                absent: v.absent,
                pending: v.pending,
                settledAttended: v.settled_att,
                openAttended: v.open_att,
            }));
            return monthStats({
                attended,
                late,
                absent,
                pending,
                attendedOpen,
                attendedSettled,
                perBranch,
                perGroup,
                perShift,
                perBranchStatus,
                singleDay: Boolean(f.day),
                days: perDay,
            });
        });
    }
    async getProbes(memberIds, from, to) {
        return this.uow.transaction(async () => {
            return this.repo.getProbesBetween(memberIds, from, to);
        });
    }
    async getProbePaths() {
        return this.uow.transaction(async () => {
            return this.repo.getAllProbePaths();
        });
    }
};
ReportsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        ReportsRepository])
], ReportsService);
export { ReportsService };
//# sourceMappingURL=reports.service.js.map