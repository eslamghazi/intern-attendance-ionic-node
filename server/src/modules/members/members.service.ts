import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { MembersRepository, MemberInput, ItemResult, DirectoryRow, MemberPageItem } from './members.repository.js';
import type { Caller } from '../../common/types.js';
import { coversUnit } from '../../domain/access/scope.js';
import type { JwtClaims } from '../../db/context.js';
import { type MemberFilters } from '../../domain/member/filter.js';

function toMemberRow(r: DirectoryRow) {
  return {
    id: r.member_id,
    profile_id: r.profile_id,
    group_id: r.group_id,
    branch_id: r.branch_id,
    is_active: r.is_active,
    bypass_face: r.bypass_face,
    bypass_location: r.bypass_location,
    bypass_checkout_window: r.bypass_checkout_window,
    frozen_at: r.frozen_at,
    can_generate_qr: r.can_generate_qr,
    can_make_roster: r.can_make_roster,
    can_reset_face: r.can_reset_face,
    enrolled: r.has_face,
    member_code: r.member_code,
    avatar_url: r.avatar_url,
    profile: {
      full_name: r.full_name,
      national_id: r.national_id,
      phone: r.phone,
      email: r.email,
    },
    group: r.group_name ? { name: r.group_name } : null,
    branch: r.branch_name ? { name: r.branch_name } : null,
  };
}

const MEMBER_COLUMNS = [
  'group_id',
  'branch_id',
  'is_active',
  'bypass_face',
  'bypass_location',
  'bypass_checkout_window',
  'frozen_at',
  'can_generate_qr',
  'can_make_roster',
  'can_reset_face',
] as const;

@Injectable()
export class MembersService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: MembersRepository,
  ) {}

  async createMembers(caller: Caller, items: MemberInput[]) {
    const { scopeOf } = await import('../../services/accessService.js');
    
    // Explicitly type scope as any or the correct type to avoid TS2345
    const scope: any = await this.uow.asService(async () => scopeOf((this.repo as any).db, caller));

    const results: ItemResult[] = [];
    for (const item of items) {
      if (!coversUnit(scope, { branchId: item.branch_id, groupId: item.group_id })) {
        results.push({
          national_id: item.national_id,
          ok: false,
          error: 'outside your assignments',
        });
        continue;
      }

      try {
        results.push(
          await this.uow.asService(async () => {
            return this.repo.upsertMember(caller.id, item);
          }),
        );
      } catch (err) {
        results.push({
          national_id: item.national_id,
          ok: false,
          error: (err as Error).message,
        });
      }
    }

    return {
      created: results.filter((r) => r.ok && !r.updated).length,
      updated: results.filter((r) => r.ok && r.updated).length,
      total: results.length,
      results,
    };
  }

  async getNationalIds(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getNationalIds();
    });
  }

  async getMembers(claims: JwtClaims, filters: MemberFilters, pageSize: number, offset: number) {
    return this.uow.asCaller(claims, async () => {
      const rows = await this.repo.getMembersDirectory(filters, pageSize, offset);
      return {
        rows: rows.map(toMemberRow),
        total: rows.length ? Number(rows[0]!.total) : 0,
      };
    });
  }

  async getMembersPage(claims: JwtClaims, filters: MemberFilters, pageSize: number, offset: number) {
    return this.uow.asCaller(claims, async () => {
      const rows = await this.repo.getMembersPage(filters, pageSize, offset);
      return {
        items: rows.map(({ total: _total, ...item }) => item),
        total: rows.length ? Number(rows[0]!.total) : 0,
      };
    });
  }

  async getFlagStats(claims: JwtClaims, filters: MemberFilters) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getFlagStats(filters);
    });
  }

  async getCountActive(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getCountActive();
    });
  }

  async getByProfile(claims: JwtClaims, profileId: string) {
    return this.uow.asCaller(claims, async () => {
      const id = await this.repo.getMemberIdByProfileId(profileId);
      return { id };
    });
  }

  async updateMember(claims: JwtClaims, id: string, b: any) {
    return this.uow.asCaller(claims, async () => {
      const profileSet: Record<string, unknown> = {
        full_name: b.full_name,
        national_id: b.national_id,
        phone: b.phone || null,
        email: b.email || null,
      };
      if (b.avatar_url !== undefined) profileSet.avatar_url = b.avatar_url;
      await this.repo.updateColumns('profiles', b.profile_id, profileSet);

      const memberSet: Record<string, unknown> = {};
      for (const k of MEMBER_COLUMNS) if (b[k] !== undefined) memberSet[k] = b[k];
      if (Object.keys(memberSet).length) await this.repo.updateColumns('members', id, memberSet);

      return { ok: true };
    });
  }

  async deleteByProfile(caller: Caller, claims: JwtClaims, profileId: string) {
    return this.uow.asCaller(claims, async () => {
      const memberId = await this.repo.getMemberIdByProfileId(profileId);
      if (memberId) {
        const { requireMember } = await import('../../services/accessService.js');
        await requireMember((this.repo as any).db, caller, memberId);
      }
      await this.repo.deleteProfile(profileId);
    });
  }

  async bulkUpdate(claims: JwtClaims, filters: MemberFilters, patch: Record<string, unknown>) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.bulkUpdateMembers(filters, patch);
    });
  }

  async bulkDelete(claims: JwtClaims, filters: MemberFilters) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.bulkDeleteProfiles(filters);
    });
  }
}
