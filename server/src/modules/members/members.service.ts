import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { MembersRepository, MemberInput, ItemResult, DirectoryRow, MemberPageItem } from './members.repository.js';
import type { Caller } from '../../common/types.js';
import { coversUnit } from '../../domain/access/scope.js';
import type { JwtClaims } from '../../db/context.js';
import { type MemberFilters } from '../../domain/member/filter.js';
import { BaseService } from '../../common/database/base.service.js';
import { members } from '../../db/schema/index.js';
import { MemberDto } from './dto/member.dto.js';
import { MembersMapper } from './members.mapper.js';

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

import type { IMembersService } from './interfaces/members.interface.js';

@Injectable()
export class MembersService extends BaseService<
  typeof members.$inferSelect,
  string,
  typeof members.$inferInsert,
  Partial<typeof members.$inferInsert>,
  MemberDto
> implements IMembersService {
  constructor(
    uow: UnitOfWorkService,
    repo: MembersRepository,
  ) {
    super(uow, repo);
  }

  protected mapToResponse(entity: any): MemberDto {
    return MembersMapper.toDto(entity);
  }

  async createMembers(caller: Caller, items: MemberInput[]) {
    const { scopeOf } = await import('../../common/auth/access.service.js');
    
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
            return (this.repo as MembersRepository).upsertMember(caller.id, item);
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
      return (this.repo as MembersRepository).getNationalIds();
    });
  }

  async getMembers(claims: JwtClaims, filters: MemberFilters, pageSize: number, offset: number) {
    return this.uow.asCaller(claims, async () => {
      const rows = await (this.repo as MembersRepository).getMembersDirectory(filters, pageSize, offset);
      return {
        rows: rows.map(toMemberRow),
        total: rows.length ? Number(rows[0]!.total) : 0,
      };
    });
  }

  async getMembersPage(claims: JwtClaims, filters: MemberFilters, pageSize: number, offset: number) {
    return this.uow.asCaller(claims, async () => {
      const rows = await (this.repo as MembersRepository).getMembersPage(filters, pageSize, offset);
      return {
        items: rows.map(({ total: _total, ...item }) => item),
        total: rows.length ? Number(rows[0]!.total) : 0,
      };
    });
  }

  async getFlagStats(claims: JwtClaims, filters: MemberFilters) {
    return this.uow.asCaller(claims, async () => {
      return (this.repo as MembersRepository).getFlagStats(filters);
    });
  }

  async getCountActive(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      return (this.repo as MembersRepository).getCountActive();
    });
  }

  async getByProfile(claims: JwtClaims, profileId: string) {
    return this.uow.asCaller(claims, async () => {
      const id = await (this.repo as MembersRepository).getMemberIdByProfileId(profileId);
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
      await (this.repo as MembersRepository).updateColumns('profiles', b.profile_id, profileSet);

      const memberSet: Record<string, unknown> = {};
      for (const k of MEMBER_COLUMNS) if (b[k] !== undefined) memberSet[k] = b[k];
      if (Object.keys(memberSet).length) await (this.repo as MembersRepository).updateColumns('members', id, memberSet);

      return { ok: true };
    });
  }

  async deleteByProfile(caller: Caller, claims: JwtClaims, profileId: string) {
    return this.uow.asCaller(claims, async () => {
      const memberId = await (this.repo as MembersRepository).getMemberIdByProfileId(profileId);
      if (memberId) {
        const { requireMember } = await import('../../common/auth/access.service.js');
        await requireMember((this.repo as any).db, caller, memberId);
      }
      await (this.repo as MembersRepository).deleteProfile(profileId);
    });
  }

  async bulkUpdate(claims: JwtClaims, filters: MemberFilters, patch: Record<string, unknown>) {
    return this.uow.asCaller(claims, async () => {
      return (this.repo as MembersRepository).bulkUpdateMembers(filters, patch);
    });
  }

  async bulkDelete(claims: JwtClaims, filters: MemberFilters) {
    return this.uow.asCaller(claims, async () => {
      return (this.repo as MembersRepository).bulkDeleteProfiles(filters);
    });
  }
}
