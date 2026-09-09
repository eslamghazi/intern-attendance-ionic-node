import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { RosterRepository } from './roster.repository.js';
import type { Caller } from '../../domain/identity/role.js';
import { requireMember, scopeOf } from '../../common/auth/access.service.js';
import { monthBounds, planBulk, rangeDates } from '../../domain/roster/bulk.js';
import { dbContextStorage } from '../../common/database/unit-of-work.service.js';

@Injectable()
export class RosterService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: RosterRepository,
  ) {}

  async getRosterView(caller: Caller, filters: any, year: number, month: number, pageSize: number, offset: number) {
    const { first, last } = monthBounds(year, month);
    return this.uow.asCaller(caller as any, async () => {
      return this.repo.getRosterView(filters, year, month, first, last, pageSize, offset);
    });
  }

  async getRosterTotals(caller: Caller, filters: any, year: number, month: number) {
    const { first, last } = monthBounds(year, month);
    return this.uow.asCaller(caller as any, async () => {
      return this.repo.getRosterTotals(filters, year, month, first, last);
    });
  }

  async getMakerData(caller: Caller, year: number, month: number) {
    const { first, last } = monthBounds(year, month);
    const empty = { members: [], shifts: [], roster: [] };
    
    return this.uow.asCaller(caller as any, async () => {
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

    return this.uow.asCaller(caller as any, async () => {
      return this.repo.getExistingKeys(memberIds, first, last);
    });
  }

  async postRosterDays(caller: Caller, days: { member_id: string; date: string; shift_id: string }[]) {
    if (!days.length) return { affected: 0 };
    return this.uow.asCaller(caller as any, async () => {
      // Validate access to members
      const scope = await scopeOf(dbContextStorage.getStore()!, caller);
      if (scope.kind !== 'all') {
        // Need to check scope
        const uniqueMemberIds = Array.from(new Set(days.map((d) => d.member_id)));
        for (const id of uniqueMemberIds) {
          // It's possible to check using query if we implement requireMember properly here,
          // but calling requireMember with a null tx will fail if it runs a query.
          // Wait, requireMember uses memberUnit which takes tx. 
          // We can just rely on the old requireMember but we must pass a valid tx if needed, or bypass it.
          // In UnitOfWorkService, the db is injected via AsyncLocalStorage.
          // Since accessService still relies on explicit tx, we can mock tx or rewrite it.
          // Actually, let's keep it simple: since accessService reads data, it will crash if it uses null.
          // So let's just pass { execute: ..., select: ... } or implement member access check directly.
        }
      }

      // For now we will rely on requireMember(null as any, caller, id) and hope it works if it uses standard Drizzle query. 
      // Wait, requireMember expects a Drizzle tx object. Since we don't have it, we can query it using repo.
      const uniqueMemberIds = Array.from(new Set(days.map((d) => d.member_id)));
      for (const id of uniqueMemberIds) {
        // Check access
        await requireMember(dbContextStorage.getStore()!, caller, id);
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
    return this.uow.asCaller(caller as any, async () => {
      await requireMember(dbContextStorage.getStore()!, caller, d.member_id);
      await this.repo.deleteDay(d.member_id, d.date, d.shift_id);
    });
  }

  async bulkRoster(caller: Caller, o: any) {
    const dates = rangeDates(o.year, o.month, o.from_day, o.to_day);
    const plan = planBulk(o.mode, o.shift_id);
    const { first, last } = monthBounds(o.year, o.month);

    return this.uow.asCaller(caller as any, async () => {
      return this.repo.bulkOperation(o, first, last, dates, plan);
    });
  }
}
