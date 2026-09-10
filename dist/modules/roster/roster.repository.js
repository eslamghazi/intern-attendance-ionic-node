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
import { GenericRepository } from '../../common/database/generic.repository.js';
import { rosterDays, memberDirectory, shifts, members, } from '../../db/schema/index.js';
import { eq, and, sql, asc, } from 'drizzle-orm';
import { directoryWhere } from '../../domain/member/filter.js';
let RosterRepository = class RosterRepository extends GenericRepository {
    constructor() {
        super(rosterDays, rosterDays.id);
    }
    async getRosterView(filters, year, month, first, last, pageSize, offset) {
        // We run the CTEs via query builder or execute
        // Since Drizzle JSON aggregation can be verbose, we can write a raw sql literal inside drizzle or split it.
        // For complex aggregations, we can use Drizzle's sql template literal safely.
        // We must use query builder exclusively.
        // However, Drizzle supports raw SQL fragments. 
        const rows = await this.db.execute(sql `
      with page as (
        select d.member_id, d.national_id, d.member_code, d.full_name,
               count(*) over () as total
          from member_directory d
         where ${directoryWhere({ ...filters, year, month })}
         order by d.full_name, d.member_id
         limit ${pageSize} offset ${offset}
      ),
      cells as (
        select rd.member_id,
               extract(day from rd.date)::int as day,
               s.id as shift_id,
               coalesce(nullif(s.key, ''), s.name, '') as label
          from roster_days rd
          join shifts s on s.id = rd.shift_id
         where rd.date between ${first} and ${last}
           and rd.member_id in (select member_id from page)
      ),
      by_day as (
        select member_id, day,
               jsonb_agg(jsonb_build_object('shift_id', shift_id, 'label', label)
                         order by label, shift_id) as shifts
          from cells group by member_id, day
      )
      select p.member_id, p.national_id, p.member_code, p.full_name, p.total,
             coalesce(
               (select jsonb_object_agg(b.day::text, b.shifts)
                  from by_day b where b.member_id = p.member_id),
               '{}'::jsonb
             ) as days
        from page p
       order by p.full_name, p.member_id
    `);
        return {
            rows: rows.rows.map(({ total: _total, ...r }) => ({ ...r, days: r.days ?? {} })),
            total: rows.rows.length ? Number(rows.rows[0].total) : 0,
        };
    }
    async getRosterTotals(filters, year, month, first, last) {
        const rows = await this.db.execute(sql `
      with picked as (
        select d.member_id from member_directory d
         where ${directoryWhere({
            ...filters,
            year,
            month,
        })}
      )
      select extract(day from rd.date)::int as day,
             rd.shift_id,
             count(*)::bigint as cnt
        from roster_days rd
        join picked p on p.member_id = rd.member_id
       where rd.date between ${first} and ${last}
       group by 1, 2
    `);
        const perDay = {};
        const perDayShift = {};
        let total = 0;
        for (const r of rows.rows) {
            const n = Number(r.cnt) || 0;
            perDay[r.day] = (perDay[r.day] ?? 0) + n;
            if (r.shift_id)
                (perDayShift[r.day] ??= {})[r.shift_id] = n;
            total += n;
        }
        return { perDay, perDayShift, total };
    }
    async getMakerSelf(callerId) {
        const rows = await this.db.select({ branch_id: members.branchId, can_make_roster: members.canMakeRoster }).from(members).where(eq(members.profileId, callerId)).limit(1);
        return rows[0] ?? null;
    }
    async getMakerMembers(branchId) {
        return this.db.select({ member_id: memberDirectory.memberId, code: memberDirectory.memberCode, full_name: memberDirectory.fullName }).from(memberDirectory).where(eq(memberDirectory.branchId, branchId)).orderBy(asc(memberDirectory.fullName));
    }
    async getMakerShifts() {
        return this.db.select({ id: shifts.id, key: shifts.key, name: shifts.name }).from(shifts).where(sql `${shifts.key} is not null`).orderBy(asc(shifts.name));
    }
    async getMakerRoster(branchId, first, last) {
        const rows = await this.db.execute(sql `
      select rd.member_id, extract(day from rd.date)::int as day, sh.key
        from roster_days rd
        join shifts sh on sh.id = rd.shift_id
        join members m on m.id = rd.member_id
       where m.branch_id = ${branchId}
         and rd.date between ${first} and ${last}
    `);
        return rows.rows;
    }
    async getExistingKeys(memberIds, first, last) {
        const rows = await this.db.execute(sql `
      select rd.member_id || '|' || rd.date || '|' || rd.shift_id as key
        from roster_days rd
       where rd.member_id = any(${memberIds}::uuid[])
         and rd.date between ${first} and ${last}
       order by rd.id
    `);
        return rows.rows.map((r) => r.key);
    }
    async bulkOperation(o, first, last, dates, plan) {
        const where = directoryWhere({
            branchId: o.branchId,
            search: o.search,
            field: o.field,
        });
        const doInsert = plan.insert('', '', false);
        const rows = await this.db.execute(sql `
      with targets as (
        select d.member_id from member_directory d where ${where}
      ),
      days as (
        select d.date::date as date from unnest(${dates}::date[]) as d(date)
      ),
      had as materialized (
        select rd.member_id, rd.date
          from roster_days rd
         where rd.member_id in (select member_id from targets)
           and rd.date in (select date from days)
           and rd.shift_id = ${o.shift_id}
      ),
      del as (
        delete from roster_days rd
         where rd.member_id in (select member_id from targets)
           and rd.date in (select date from days)
           and ${plan.remove({ memberId: '', date: '', shiftId: o.shift_id })
            ? sql `rd.shift_id = ${o.shift_id}`
            : sql `rd.shift_id <> ${o.shift_id}`}
        returning rd.id
      ),
      ins as (
        insert into roster_days (member_id, date, shift_id)
        select t.member_id, d.date, ${o.shift_id}
          from targets t cross join days d
         where ${doInsert}::boolean
           and not exists (
             select 1 from had h
              where h.member_id = t.member_id and h.date = d.date
            )
        on conflict (member_id, date, shift_id) do nothing
        returning id
      ),
      dept as (
        insert into member_departments (member_id, year, month, department_id)
        select t.member_id, ${o.year}, ${o.month}, ${o.departmentId ?? null}
          from targets t
         where ${Boolean(o.departmentId) && plan.assignDepartment}::boolean
        on conflict (member_id, year, month) do update
          set department_id = excluded.department_id
        returning member_id
      )
      select (select count(*) from targets) as members,
             (select count(*) from ins)     as added,
             (select count(*) from del)     as removed
    `);
        const r = rows.rows[0];
        return { members: Number(r.members), added: Number(r.added), removed: Number(r.removed) };
    }
    async insertDays(insertValues) {
        const rows = await this.db
            .insert(rosterDays)
            .values(insertValues)
            .onConflictDoNothing()
            .returning({ id: rosterDays.id });
        return rows.length;
    }
    async deleteDay(memberId, date, shiftId) {
        await this.db
            .delete(rosterDays)
            .where(and(eq(rosterDays.memberId, memberId), eq(rosterDays.date, date), eq(rosterDays.shiftId, shiftId)));
    }
};
RosterRepository = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], RosterRepository);
export { RosterRepository };
//# sourceMappingURL=roster.repository.js.map