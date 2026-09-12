import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { RosterRepository } from './roster.repository.js';
import type { Caller } from '../../domain/identity/role.js';
import { requireFilter, requireMember, scopeFilter } from '../../common/auth/access.service.js';
import { monthBounds, planBulk, rangeDates } from '../../domain/roster/bulk.js';

import type { IRosterService } from './interfaces/roster.interface.js';

@Injectable()
export class RosterService implements IRosterService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: RosterRepository,
  ) {}

  async getRosterView(caller: Caller, filters: any, year: number, month: number, pageSize: number, offset: number) {
    const { first, last } = monthBounds(year, month);
    return this.uow.transaction(async (tx) => {
      // NARROWED, not refused: an admin assigned to two branches sees both, and
      // a screen opening with no branch chosen shows their reach instead of a
      // 403. The scope rides inside the filter so paging and counts agree.
      const scoped = { ...filters, scope: await scopeFilter(tx, caller) };

      return this.repo.getRosterView(scoped, year, month, first, last, pageSize, offset);
    });
  }

  /**
   * Every row of the monthly roster, plus what an export needs to label it:
   * the shifts (one column each) and each member's department for that month.
   */
  async getRosterForExport(caller: Caller, filters: any, year: number, month: number) {
    const { first, last } = monthBounds(year, month);

    return this.uow.transaction(async (tx) => {
      // NARROWED, not refused: an admin assigned to two branches sees both, and
      // a screen opening with no branch chosen shows their reach instead of a
      // 403. The scope rides inside the filter so paging and counts agree.
      const scoped = { ...filters, scope: await scopeFilter(tx, caller) };

      const view = await this.repo.getRosterView(scoped, year, month, first, last, null, 0);
      const shifts = await this.repo.getMakerShifts();
      const departments = await this.repo.getDepartmentNames(
        view.rows.map((r) => r.member_id),
        year,
        month,
      );
      return { rows: view.rows, shifts, departments };
    });
  }

  async getRosterTotals(caller: Caller, filters: any, year: number, month: number) {
    const { first, last } = monthBounds(year, month);
    return this.uow.transaction(async (tx) => {
      // NARROWED, not refused: an admin assigned to two branches sees both, and
      // a screen opening with no branch chosen shows their reach instead of a
      // 403. The scope rides inside the filter so paging and counts agree.
      const scoped = { ...filters, scope: await scopeFilter(tx, caller) };

      return this.repo.getRosterTotals(scoped, year, month, first, last);
    });
  }

  async getMakerData(caller: Caller, year: number, month: number) {
    const { first, last } = monthBounds(year, month);
    const empty = { members: [], shifts: [], roster: [] };
    
    return this.uow.transaction(async () => {
      const self = await this.repo.getMakerSelf(caller.id);
      if (!self?.can_make_roster) return empty;
      const branchId = self.branch_id;

      const [members, shifts, roster] = await Promise.all([
        this.repo.getMakerMembers(branchId),
        this.repo.getMakerShifts(),
        this.repo.getMakerRoster(branchId, first, last),
      ]);

      return { members, shifts, roster };
    });
  }

  async getExistingKeys(caller: Caller, year: number, month: number, memberIds: string[]) {
    if (!memberIds.length) return [];
    const { first, last } = monthBounds(year, month);

    return this.uow.transaction(async () => {
      return this.repo.getExistingKeys(memberIds, first, last);
    });
  }

  /**
   * Add roster slots.
   *
   * Every distinct member named in the batch is checked, once. `requireMember`
   * throws on the first one this caller may not reach, so a batch that mixes
   * reachable and unreachable members writes NOTHING — it is one transaction.
   */
  async postRosterDays(caller: Caller, days: { member_id: string; date: string; shift_id: string }[]) {
    if (!days.length) return { affected: 0 };

    return this.uow.transaction(async (tx) => {
      // There was a `scopeOf()` call and an `if (scope.kind !== 'all')` branch
      // above this whose body was empty — only a paragraph of unresolved
      // comments debating how to get a transaction handle here. It cost a query
      // per request and decided nothing: requireMember below already applies the
      // scope, for every caller, and it is the check that actually refuses.
      const uniqueMemberIds = Array.from(new Set(days.map((d) => d.member_id)));
      for (const id of uniqueMemberIds) {
        await requireMember(tx, caller, id);
      }

      const insertValues = days.map((d) => ({
        memberId: d.member_id,
        date: d.date,
        shiftId: d.shift_id,
      }));

      const affected = await this.repo.insertDays(insertValues);
      return { affected };
    });
  }

  async deleteRosterDays(caller: Caller, d: { member_id: string; date: string; shift_id: string }) {
    return this.uow.transaction(async (tx) => {
      await requireMember(tx, caller, d.member_id);
      await this.repo.deleteDay(d.member_id, d.date, d.shift_id);
    });
  }

  /**
   * Apply a roster change to every member the filter matches.
   *
   * SCOPED, and this is the one that matters most: the statement behind it also
   * deletes the attendance rows for any slot it removes, so an unscoped call
   * here does not just read another branch's data — it rewrites it.
   */
  async bulkRoster(caller: Caller, o: any) {
    const dates = rangeDates(o.year, o.month, o.from_day, o.to_day);
    const plan = planBulk(o.mode, o.shift_id);
    const { first, last } = monthBounds(o.year, o.month);

    return this.uow.transaction(async (tx) => {
      // An assigned admin must name a branch or group they cover. Staff-only is
      // not enough here: it answers "are you staff", not "is this yours".
      await requireFilter(tx, caller, {
        branchId: o.branchId ?? null,
        groupId: o.groupId ?? null,
      });

      return this.repo.bulkOperation(o, first, last, dates, plan);
    });
  }
}
