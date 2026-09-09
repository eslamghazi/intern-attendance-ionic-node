import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { ReportsRepository } from './reports.repository.js';
import type { JwtClaims } from '../../db/context.js';
import { monthBounds } from '../../domain/member/filter.js';
import { monthStats } from '../../domain/report/rate.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: ReportsRepository,
  ) {}

  async getPresent(claims: JwtClaims, dates: string[]) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getPresent(dates);
    });
  }

  async getReview(claims: JwtClaims, date: string, branchId?: string | null) {
    return this.uow.asCaller(claims, async () => {
      const rows = await this.repo.getReview(date, branchId);
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

  async getDetail(claims: JwtClaims, memberId: string, date: string, shiftId?: string | null) {
    return this.uow.asCaller(claims, async () => {
      const r = await this.repo.getDetail(memberId, date, shiftId);
      if (!r) return null;
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

  async getHistory(claims: JwtClaims, memberId: string, year?: number, month?: number) {
    return this.uow.asCaller(claims, async () => {
      if (!year || !month) {
        const rows = await this.repo.getAttendanceHistorySimple(memberId);
        return rows.map((r) => ({
          id: String(r.id),
          date: r.date,
          shift_id: r.shift_id,
          shift_name: r.shift_name,
          status: r.check_in_at === null ? 'absent' : r.status === 'late' ? 'late' : 'present',
          check_in_at: r.check_in_at,
          check_out_at: r.check_out_at,
          checkout_status: r.checkout_status,
        }));
      }

      const { first, last } = monthBounds(year, month);
      
      const rosterRows = await this.repo.getRosterBetween(memberId, first, last);
      const attRows = await this.repo.getAttendanceBetween(memberId, first, last);

      const items: any[] = [];
      const rosterMap = new Map<string, any>();
      
      for (const r of rosterRows) {
        const key = `${r.date}_${r.shift_id ?? 'null'}`;
        rosterMap.set(key, r);
        
        const a = attRows.find((att) => att.date === r.date && att.shiftId === r.shift_id);
        
        let status = 'pending';
        if (a && a.checkInAt) {
          status = a.status === 'late' ? 'late' : 'present';
        } else if (r.done) {
          status = 'absent';
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
            status: a.checkInAt === null ? 'absent' : a.status === 'late' ? 'late' : 'present',
            check_in_at: a.checkInAt,
            check_out_at: a.checkOutAt,
            checkout_status: a.checkoutStatus,
          });
        }
      }
      
      items.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (a.shift_name ?? '').localeCompare(b.shift_name ?? '');
      });
      
      return items;
    });
  }

  async getDay(claims: JwtClaims, memberId: string, date: string) {
    return this.uow.asCaller(claims, async () => {
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

  async getDailyRoster(claims: JwtClaims, date: string, branchId?: string | null) {
    return this.uow.asCaller(claims, async () => {
      const expected = await this.repo.getDailyExpected(date, branchId);
      const att = await this.repo.getDailyAttendance(date, branchId);
      
      const peopleMap = new Map<string, any>();
      
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
        } else {
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
          status = a.status ?? 'present';
        } else if (p.done) {
          status = 'absent';
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
        const rankA = a.check_in_at && a.status !== 'late' && a.status !== 'early_leave' ? 0
                    : a.check_in_at && a.status === 'late' ? 1
                    : a.check_in_at && a.status === 'early_leave' ? 2
                    : a.status === 'absent' ? 4 : 3;
        const rankB = b.check_in_at && b.status !== 'late' && b.status !== 'early_leave' ? 0
                    : b.check_in_at && b.status === 'late' ? 1
                    : b.check_in_at && b.status === 'early_leave' ? 2
                    : b.status === 'absent' ? 4 : 3;
                    
        if (rankA !== rankB) return rankA - rankB;
        return a.full_name.localeCompare(b.full_name);
      });
      
      return results;
    });
  }

  async getMonthly(claims: JwtClaims, filters: any, year: number, month: number, page: number, pageSize: number) {
    const { first, last } = monthBounds(year, month);
    const offset = (page - 1) * pageSize;

    return this.uow.asCaller(claims, async () => {
      const pageRows = await this.repo.getMemberDirectoryPage(filters, year, month, pageSize, offset);
      const total = await this.repo.getMemberDirectoryCount(filters, year, month);
      
      const memberIds = pageRows.map(r => r.member_id as string).filter(Boolean);
      
      const rosterRows = await this.repo.getRosterForMembersBetween(memberIds, first, last);
      const attRows = await this.repo.getAttendanceForMembersBetween(memberIds, first, last);
      
      const results = pageRows.map(p => {
        const days: Record<string, string[]> = {};
        const checkouts: Record<string, (string | null)[]> = {};
        
        const mRoster = rosterRows.filter(r => r.member_id === p.member_id);
        const mAtt = attRows.filter(a => a.member_id === p.member_id);
        
        const slotsMap = new Map<string, { in_status: string, out_status: string | null }>();
        
        for (const r of mRoster) {
          const key = `${r.date}_${r.shift_id ?? 'null'}`;
          const a = mAtt.find(att => att.date === r.date && att.shift_id === r.shift_id);
          
          let in_status = 'pending';
          if (a && a.check_in_at) {
            in_status = a.status === 'late' ? 'late' : 'present';
          } else if (r.done) {
            in_status = 'absent';
          }
          
          let out_status: string | null = null;
          if (a && a.checkout_status) out_status = a.checkout_status;
          else if (a?.status === 'left_work') out_status = 'left_work';
          else if (a?.status === 'early_leave') out_status = 'early_leave';
          
          slotsMap.set(key, { in_status, out_status });
        }
        
        for (const a of mAtt) {
          const key = `${a.date}_${a.shift_id ?? 'null'}`;
          if (!slotsMap.has(key)) {
            let in_status = a.status === 'late' ? 'late' : 'present';
            let out_status: string | null = null;
            if (a.checkout_status) out_status = a.checkout_status;
            else if (a.status === 'left_work') out_status = 'left_work';
            else if (a.status === 'early_leave') out_status = 'early_leave';
            
            slotsMap.set(key, { in_status, out_status });
          }
        }
        
        for (const [key, val] of slotsMap.entries()) {
          const [dateStr, shiftStr] = key.split('_');
          const day = String(new Date(dateStr!).getDate());
          
          if (!days[day]) {
            days[day] = [];
            checkouts[day] = [];
          }
          // The query ordered by shift_id implicitly but doing it via JSON is unordered
          days[day]!.push(val.in_status as string);
          checkouts[day]!.push(val.out_status as string | null);
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

  async getReport(claims: JwtClaims, from: string, to: string, branchId?: string | null, groupId?: string | null) {
    return this.uow.asCaller(claims, async () => {
      const rows = await this.repo.getReportAttendanceBetween(from, to, branchId, groupId);
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

  async getToday(claims: JwtClaims, date: string) {
    return this.uow.asCaller(claims, async () => {
      const rows = await this.repo.getTodayAttendance(date);
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

  async getStats(
    claims: JwtClaims,
    year: number,
    month: number,
    f: { branchId?: string | null; groupId?: string | null; shiftId?: string | null; day?: number | null; departmentId?: string | null }
  ) {
    const { first, last } = monthBounds(year, month);
    const daysInMonth = new Date(year, month, 0).getDate();

    return this.uow.asCaller(claims, async () => {
      const atts = await this.repo.getStatsAttendance(first, last, f);
      const rosters = await this.repo.getStatsRoster(first, last, f);
      
      let attended = 0;
      let late = 0;
      let absent = 0;
      let pending = 0;
      let attendedOpen = 0;
      let attendedSettled = 0;
      
      const perBranchMap = new Map<string, number>();
      const perGroupMap = new Map<string, number>();
      const perShiftMap = new Map<string, number>();
      
      const perBranchStatusMap = new Map<string, { present: number; late: number; absent: number }>();
      const perDayMap = new Map<number, { attended: number; absent: number; pending: number; settled_att: number; open_att: number }>();
      
      for (let i = 1; i <= daysInMonth; i++) {
        perDayMap.set(i, { attended: 0, absent: 0, pending: 0, settled_att: 0, open_att: 0 });
      }

      const judged = new Set<string>();

      for (const a of atts) {
        if (!a.check_in_at) continue;
        
        attended++;
        if (a.status === 'late') late++;
        
        const day = new Date(String(a.date)).getDate();
        const dStat = perDayMap.get(day);
        if (dStat) dStat.attended++;

        if (a.branch_id) perBranchMap.set(a.branch_id, (perBranchMap.get(a.branch_id) || 0) + 1);
        if (a.group_id) perGroupMap.set(a.group_id, (perGroupMap.get(a.group_id) || 0) + 1);
        if (a.shift_id) perShiftMap.set(a.shift_id, (perShiftMap.get(a.shift_id) || 0) + 1);
        
        if (a.branch_id) {
          const bs = perBranchStatusMap.get(a.branch_id) || { present: 0, late: 0, absent: 0 };
          if (a.status === 'late') bs.late++;
          else bs.present++;
          perBranchStatusMap.set(a.branch_id, bs);
        }
      }

      for (const r of rosters) {
        const key = `${r.member_id}_${r.date}_${r.shift_id ?? 'null'}`;
        if (judged.has(key)) continue;
        judged.add(key);

        const a = atts.find((att) => att.member_id === r.member_id && att.date === r.date && att.shift_id === r.shift_id);
        const came = a?.check_in_at != null;
        const done = r.done;
        const day = new Date(String(r.date)).getDate();
        const dStat = perDayMap.get(day);

        if (done && !came) {
          absent++;
          if (dStat) dStat.absent++;
          if (r.branch_id) {
            const bs = perBranchStatusMap.get(r.branch_id) || { present: 0, late: 0, absent: 0 };
            bs.absent++;
            perBranchStatusMap.set(r.branch_id, bs);
          }
        } else if (!done && !came) {
          pending++;
          if (dStat) dStat.pending++;
        } else if (!done && came) {
          attendedOpen++;
          if (dStat) dStat.open_att++;
        } else if (done && came) {
          attendedSettled++;
          if (dStat) dStat.settled_att++;
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

  async getProbes(claims: JwtClaims, memberIds: string[], from: string, to: string) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getProbesBetween(memberIds, from, to);
    });
  }

  async getProbePaths(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getAllProbePaths();
    });
  }
}
