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
import { GenericRepository } from '../../infrastructure/database/generic.repository.js';
import { rosterDays, memberDirectory, shifts, members, memberDepartments, departments, attendance, } from '../../infrastructure/database/schema/index.js';
import { eq, and, count, inArray, between, sql, asc, isNotNull, } from 'drizzle-orm';
import { dayInMonth, dayOfMonth, directoryWhere, filteredMemberIds } from '../../domain/member/filter.js';
let RosterRepository = class RosterRepository extends GenericRepository {
    constructor() {
        super(rosterDays, rosterDays.id);
    }
    /**
     * One page of the monthly roster grid: a member per row, their shifts per day.
     *
     * Three queries: the page of members, the count behind it, and the roster
     * cells for exactly those members — with the per-day map assembled here.
     *
     * A `jsonb_object_agg` in the database could build that map in one statement,
     * and it would buy nothing: every row it aggregates is travelling to Node
     * regardless, and the shape it produces goes straight to the client. What it
     * would cost is a query no type describes and no test can reach.
     *
     * The count is its own query rather than `count(*) over ()` riding along on
     * each row. That also fixes a real edge: the window function returned a total
     * of 0 for any page past the end, because a page with no rows carries no
     * window value.
     */
    async getRosterView(filters, year, month, first, last, pageSize, offset) {
        const where = directoryWhere({ ...filters, year, month });
        const pageQuery = this.db
            .select({
            member_id: memberDirectory.memberId,
            national_id: memberDirectory.nationalId,
            member_code: memberDirectory.memberCode,
            full_name: memberDirectory.fullName,
        })
            .from(memberDirectory)
            .where(where)
            .orderBy(asc(memberDirectory.fullName), asc(memberDirectory.memberId));
        // `pageSize === null` means every match — what an export asks for. Same
        // predicate and ordering either way, so the file and the grid agree.
        const page = pageSize === null ? await pageQuery : await pageQuery.limit(pageSize).offset(offset);
        const totalRows = await this.db
            .select({ n: count() })
            .from(memberDirectory)
            .where(where);
        const total = Number(totalRows[0]?.n ?? 0);
        if (!page.length)
            return { rows: [], total };
        const memberIds = page.map((p) => p.member_id).filter(Boolean);
        // The cells follow the filter: a day narrows the grid to that column, a
        // shift to that shift's entries — in the export as much as on screen.
        const cellWhere = [inArray(rosterDays.memberId, memberIds)];
        cellWhere.push(filters?.day ? eq(rosterDays.date, dayInMonth(first, filters.day)) : between(rosterDays.date, first, last));
        if (filters?.shiftId)
            cellWhere.push(eq(rosterDays.shiftId, filters.shiftId));
        const cells = await this.db
            .select({
            member_id: rosterDays.memberId,
            date: rosterDays.date,
            shift_id: shifts.id,
            key: shifts.key,
            name: shifts.name,
        })
            .from(rosterDays)
            .innerJoin(shifts, eq(shifts.id, rosterDays.shiftId))
            .where(and(...cellWhere));
        const byMember = new Map();
        for (const c of cells) {
            const days = byMember.get(c.member_id) ?? {};
            const day = String(dayOfMonth(c.date));
            // `coalesce(nullif(s.key, ''), s.name, '')` — the short key is the label
            // when there is one, because a grid cell is a few characters wide.
            (days[day] ??= []).push({ shift_id: c.shift_id, label: c.key || c.name || '' });
            byMember.set(c.member_id, days);
        }
        // Was `order by label, shift_id` inside the aggregate: two shifts on one day
        // must not swap places between requests, or the grid appears to flicker.
        for (const days of byMember.values()) {
            for (const list of Object.values(days)) {
                list.sort((a, b) => a.label.localeCompare(b.label) || a.shift_id.localeCompare(b.shift_id));
            }
        }
        // The view's columns are all nullable to Drizzle — a view has no NOT NULL to
        // read — but member_id, national_id and full_name come from base columns
        // that are. Asserted once, here, rather than left to leak through the DTO.
        return {
            rows: page.map((p) => ({
                member_id: p.member_id,
                national_id: p.national_id,
                member_code: p.member_code,
                full_name: p.full_name,
                days: byMember.get(p.member_id) ?? {},
            })),
            total,
        };
    }
    /** The per-day and per-day-per-shift totals under the grid. */
    async getRosterTotals(filters, year, month, first, last) {
        const rows = await this.db
            .select({ date: rosterDays.date, shift_id: rosterDays.shiftId, cnt: count() })
            .from(rosterDays)
            .where(and(between(rosterDays.date, first, last), 
        // The `picked` CTE, as a subquery. Still one statement, still never
        // pulls the member ids through Node.
        inArray(rosterDays.memberId, filteredMemberIds({ ...filters, year, month }))))
            .groupBy(rosterDays.date, rosterDays.shiftId);
        const perDay = {};
        const perDayShift = {};
        let total = 0;
        for (const r of rows) {
            // Grouped by the whole date rather than by its day: the rows are a single
            // month, so the two group the same, and this one needs no SQL function.
            const day = dayOfMonth(r.date);
            const n = Number(r.cnt) || 0;
            perDay[day] = (perDay[day] ?? 0) + n;
            if (r.shift_id)
                (perDayShift[day] ??= {})[r.shift_id] = n;
            total += n;
        }
        return { perDay, perDayShift, total };
    }
    /**
     * The department each member is assigned to for this (year, month).
     *
     * An assignment is per MONTH — a member rotates — so this cannot be read off
     * the member row. Returned as a Map because the export looks it up per row.
     */
    async getDepartmentNames(memberIds, year, month) {
        if (!memberIds.length)
            return new Map();
        const rows = await this.db
            .select({ member_id: memberDepartments.memberId, name: departments.name })
            .from(memberDepartments)
            .innerJoin(departments, eq(departments.id, memberDepartments.departmentId))
            .where(and(inArray(memberDepartments.memberId, memberIds), eq(memberDepartments.year, year), eq(memberDepartments.month, month)));
        return new Map(rows.map((r) => [r.member_id, r.name]));
    }
    async getMakerSelf(callerId) {
        const rows = await this.db.select({ branch_id: members.branchId, can_make_roster: members.canMakeRoster }).from(members).where(eq(members.profileId, callerId)).limit(1);
        return rows[0] ?? null;
    }
    async getMakerMembers(branchId) {
        return this.db.select({ member_id: memberDirectory.memberId, code: memberDirectory.memberCode, full_name: memberDirectory.fullName }).from(memberDirectory).where(eq(memberDirectory.branchId, branchId)).orderBy(asc(memberDirectory.fullName));
    }
    async getMakerShifts() {
        return this.db.select({ id: shifts.id, key: shifts.key, name: shifts.name }).from(shifts).where(isNotNull(shifts.key)).orderBy(asc(shifts.name));
    }
    async getMakerRoster(branchId, first, last) {
        const rows = await this.db
            .select({ member_id: rosterDays.memberId, date: rosterDays.date, key: shifts.key })
            .from(rosterDays)
            .innerJoin(shifts, eq(shifts.id, rosterDays.shiftId))
            .innerJoin(members, eq(members.id, rosterDays.memberId))
            .where(and(eq(members.branchId, branchId), between(rosterDays.date, first, last)));
        return rows.map((r) => ({ member_id: r.member_id, day: dayOfMonth(r.date), key: r.key }));
    }
    /**
     * The slots that already exist, as `memberId|date|shiftId` strings.
     *
     * Built here rather than concatenated in SQL, so the separator lives next to
     * the code that splits on it instead of in a string in another language.
     */
    async getExistingKeys(memberIds, first, last) {
        if (!memberIds.length)
            return [];
        const rows = await this.db
            .select({ memberId: rosterDays.memberId, date: rosterDays.date, shiftId: rosterDays.shiftId })
            .from(rosterDays)
            .where(and(inArray(rosterDays.memberId, memberIds), between(rosterDays.date, first, last)))
            .orderBy(asc(rosterDays.id));
        return rows.map((r) => `${r.memberId}|${r.date}|${r.shiftId}`);
    }
    async bulkOperation(o, first, last, dates, plan) {
        const targets = filteredMemberIds({
            branchId: o.branchId,
            search: o.search,
            field: o.field,
        });
        const doInsert = plan.insert('', '', false);
        const rows = await this.db.execute(sql `
      with targets as (${targets}),
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
        returning rd.member_id, rd.date, rd.shift_id
      ),
      -- Was the sync_attendance_with_roster trigger, and it stays in THIS
      -- statement rather than becoming a second round trip: the whole roster
      -- apply is one atomic step, and an attendance row outliving its roster
      -- slot for even a moment is the inconsistency the trigger existed to
      -- prevent.
      del_attendance as (
        delete from attendance a
         using del d
         where a.member_id = d.member_id
           and a.date = d.date
           and a.shift_id = d.shift_id
        returning a.id
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
        // Was the `sync_attendance_with_roster` trigger. A slot removed from the
        // roster takes its attendance row with it: the record existed because the
        // member was expected that day, and it is not a day they are
        // expected. Leaving it behind shows a student as present for a shift the
        // roster says never applied to them.
        await this.db
            .delete(attendance)
            .where(and(eq(attendance.memberId, memberId), eq(attendance.date, date), eq(attendance.shiftId, shiftId)));
    }
};
RosterRepository = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], RosterRepository);
export { RosterRepository };
//# sourceMappingURL=roster.repository.js.map