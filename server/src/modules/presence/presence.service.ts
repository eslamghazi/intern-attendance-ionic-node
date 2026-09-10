import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { PresenceRepository } from './presence.repository.js';
import type { Caller } from '../../common/types.js';
import { requireFilter } from '../../common/auth/access.service.js';
import { cairoNow } from '../../domain/clock.js';
import { previousDate } from '../../domain/attendance/windows.js';
import { ApiError, forbidden, notFound } from '../../http/errors.js';
import { PresenceStatus, PresenceDecision } from '../../common/enums/index.js';

import type { IPresenceService } from './interfaces/presence.interface.js';

@Injectable()
export class PresenceService implements IPresenceService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: PresenceRepository,
  ) {}

  private async ownedCheck(checkId: string, callerId: string) {
    const check = await this.repo.getOwnedCheck(checkId, callerId);
    if (!check) throw forbidden();
    return check;
  }

  async createCheck(
    caller: Caller,
    b: {
      branch_id?: string | null;
      group_id?: string | null;
      department_id?: string | null;
      shift_id?: string | null;
      deadline_minutes: number;
    },
  ) {
    return this.uow.asService(async () => {
      // Access service methods require tx. But we are in uow.
      // So we use the underlying db of the repo.
      await requireFilter((this.repo as any).db, caller, {
        branchId: b.branch_id ?? null,
        groupId: b.group_id ?? null,
      });

      const today = cairoNow().date;
      const [yearStr, monthStr] = today.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);

      const targets = await this.repo.findActiveTargets(
        [today, previousDate(today)],
        b.branch_id ?? null,
        b.group_id ?? null,
        b.department_id ?? null,
        year,
        month,
      );

      if (!targets.length) {
        throw new ApiError(422, 'no_targets', 'nobody is on shift right now');
      }

      const minutes = Math.max(1, Math.min(240, b.deadline_minutes || 10));
      const deadline = new Date(Date.now() + minutes * 60000).toISOString();

      const check = await this.repo.createCheck({
        createdBy: caller.id,
        branchId: b.branch_id ?? null,
        groupId: b.group_id ?? null,
        departmentId: b.department_id ?? null,
        shiftId: b.shift_id ?? null,
        date: today,
        deadline,
        targetMemberIds: targets,
      });

      return { ok: true, check, target_count: targets.length };
    });
  }

  async getChecks(callerId: string) {
    return this.uow.asService(async () => {
      const recentChecks = await this.repo.getRecentChecks(callerId);
      
      const allTargetIds = new Set<string>();
      for (const c of recentChecks) {
        for (const t of c.targetMemberIds || []) {
          allTargetIds.add(t);
        }
      }

      const profileRows = await this.repo.getProfilesForMembers(Array.from(allTargetIds));
      const profileMap = new Map(profileRows.map((p) => [p.memberId, p.fullName]));

      const checkIds = recentChecks.map((c) => c.id);
      const confirmations = await this.repo.getConfirmationsForChecks(checkIds);
      
      const confirmedSet = new Set(confirmations.map((c) => `${c.checkId}_${c.memberId}`));

      const checks = recentChecks.map((r) => {
        const targets = r.targetMemberIds || [];
        const confirmedCount = targets.filter((t) => confirmedSet.has(`${r.id}_${t}`)).length;
        const pending = targets
          .filter((t) => !confirmedSet.has(`${r.id}_${t}`))
          .map((t) => ({
            member_id: t,
            full_name: profileMap.get(t) || '',
          }));

        return {
          id: r.id,
          created_by: r.createdBy,
          branch_id: r.branchId,
          group_id: r.groupId,
          department_id: r.departmentId,
          shift_id: r.shiftId,
          date: r.date,
          deadline: r.deadline,
          target_member_ids: targets,
          status: r.status,
          decision: r.decision,
          created_at: r.createdAt,
          resolved_at: r.resolvedAt,
          target_count: targets.length,
          confirmed_count: confirmedCount,
          pending,
          past_deadline: new Date(r.deadline).getTime() < Date.now(),
        };
      });

      return { checks };
    });
  }

  async deleteCheck(callerId: string, id: string) {
    return this.uow.asService(async () => {
      await this.ownedCheck(id, callerId);
      await this.repo.deleteCheck(id);
    });
  }

  async confirmByAdmin(callerId: string, id: string, memberId: string) {
    return this.uow.asService(async () => {
      const check = await this.ownedCheck(id, callerId);
      if (check.status !== PresenceStatus.OPEN) throw new ApiError(409, 'not_open', 'this check is closed');
      
      if (!(check.targetMemberIds ?? []).includes(memberId)) {
        throw forbidden('not_targeted');
      }

      await this.repo.confirmCheck(id, memberId);
      return { ok: true };
    });
  }

  async resolveCheck(callerId: string, id: string, decision: string) {
    return this.uow.asService(async () => {
      const check = await this.ownedCheck(id, callerId);
      
      if (check.status === PresenceStatus.RESOLVED) {
        throw new ApiError(409, 'already_resolved', 'this check is already resolved');
      }

      if (decision === PresenceDecision.LEFT_WORK) {
        await this.repo.resolveLeftWork(
          id,
          check.date,
          check.shiftId,
          check.targetMemberIds || [],
        );
      }

      await this.repo.markCheckResolved(id, decision);
      
      return { ok: true, decision };
    });
  }

  async getPending(callerId: string) {
    return this.uow.asService(async () => {
      const memberId = await this.repo.getMemberIdByProfileId(callerId);
      if (!memberId) return { pending: null };

      const pending = await this.repo.getPendingCheckForMember(memberId);
      return { pending };
    });
  }

  async confirmByMember(callerId: string, checkId: string) {
    return this.uow.asService(async () => {
      const memberId = await this.repo.getMemberIdByProfileId(callerId);
      if (!memberId) throw forbidden('not_a_member');

      const check = await this.repo.getCheck(checkId);
      if (!check) throw notFound();
      if (check.status !== PresenceStatus.OPEN) throw new ApiError(409, 'not_open', 'this check is closed');
      
      const isExpired = new Date(check.deadline).getTime() < Date.now();
      if (isExpired) throw new ApiError(410, 'deadline_passed', 'the deadline has passed');
      
      const isTargeted = (check.targetMemberIds ?? []).includes(memberId);
      if (!isTargeted) throw forbidden('not_targeted');

      await this.repo.confirmCheck(checkId, memberId);
      return { ok: true };
    });
  }
}
