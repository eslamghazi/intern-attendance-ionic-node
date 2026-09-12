import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { MembersRepository, MemberInput, ItemResult, DirectoryRow, MemberPageItem } from './members.repository.js';
import type { Caller } from '../../common/types.js';
import { coversUnit } from '../../domain/access/scope.js';
import { scopeOf } from '../../common/auth/access.service.js';
import { AuditEvent } from '../../common/enums/index.js';
import { AuditService } from '../audit/audit.service.js';
import type { JwtClaims } from '../../infrastructure/database/context.js';
import { type MemberFilters } from '../../domain/member/filter.js';
import { BaseService } from '../../infrastructure/database/base.service.js';
import { members } from '../../infrastructure/database/schema/index.js';
import { MemberDto } from './dto/member.dto.js';
import type { UpdateMemberDto } from './dto/member.dto.js';
import type { LookupResult, MemberFieldPatch } from './members.types.js';
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

import type { IMembersService } from './interfaces/members.interface.js';

@Injectable()
export class MembersService extends BaseService<typeof members, MemberDto> implements IMembersService {
  constructor(
    uow: UnitOfWorkService,
    repo: MembersRepository,
    private readonly audit: AuditService,
  ) {
    super(uow, repo);
  }

  protected mapToResponse(entity: any): MemberDto {
    return MembersMapper.toDto(entity);
  }

  async createMembers(caller: Caller, items: MemberInput[]) {
    const { scopeOf } = await import('../../common/auth/access.service.js');
    
    // Explicitly type scope as any or the correct type to avoid TS2345
    const scope: any = await this.uow.transaction(async () => scopeOf((this.repo as any).db, caller));

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
          await this.uow.transaction(async () => {
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

  async getNationalIds() {
    return this.uow.transaction(async () => {
      return (this.repo as MembersRepository).getNationalIds();
    });
  }

  async getMembers(filters: MemberFilters, pageSize: number, offset: number) {
    return this.uow.transaction(async () => {
      const { rows, total } = await (this.repo as MembersRepository).getMembersDirectory(filters, pageSize, offset);
      return { rows: rows.map(toMemberRow), total };
    });
  }

  /** Every member the filters match — the rows an export is built from. */
  /**
   * Find one member by their code or national id — ANY member, faculty-wide.
   *
   * THE ONE DELIBERATE HOLE IN THE BRANCH SCOPE, and it is a hole on purpose.
   * A student turns up at the wrong hospital, or a supervisor needs to confirm
   * who is standing in front of them; refusing because the member belongs to
   * another branch would make the system wrong about the situation it exists to
   * record.
   *
   * What keeps it from being a way around the scope:
   *
   *   * it answers ONE member, never a list — there is nothing to page through;
   *   * the match is EXACT, so the caller already knew the identifier;
   *   * a lookup outside the caller's own assignments is AUDITED, with who
   *     looked up whom. The act is allowed and recorded, which is what makes it
   *     different from the browsing the scope refuses.
   */
  async lookup(caller: Caller, identifier: string): Promise<LookupResult> {
    return this.uow.transaction(async (tx) => {
      const row = await (this.repo as MembersRepository).findByIdentifier(identifier);
      if (!row) return { found: false as const };

      const scope = await scopeOf(tx, caller);
      const inScope =
        scope.kind === 'all' ||
        (scope.kind !== 'none' &&
          coversUnit(scope, { branchId: row.branch_id ?? null, groupId: row.group_id ?? null }));

      if (!inScope) {
        await this.audit.record(caller.id, AuditEvent.MEMBER_LOOKUP_OUT_OF_SCOPE, {
          member_id: row.member_id,
          member_code: row.member_code,
          branch_id: row.branch_id,
          group_id: row.group_id,
        });
      }

      return { found: true as const, in_scope: inScope, member: row };
    });
  }

  async getMembersForExport(filters: MemberFilters) {
    return this.uow.transaction(async () =>
      (this.repo as MembersRepository).getMembersForExport(filters),
    );
  }

  async getMembersPage(filters: MemberFilters, pageSize: number, offset: number) {
    return this.uow.transaction(async () => {
      return (this.repo as MembersRepository).getMembersPage(filters, pageSize, offset);
    });
  }

  async getFlagStats(filters: MemberFilters) {
    return this.uow.transaction(async () => {
      return (this.repo as MembersRepository).getFlagStats(filters);
    });
  }

  async getCountActive() {
    return this.uow.transaction(async () => {
      return (this.repo as MembersRepository).getCountActive();
    });
  }

  async getByProfile(profileId: string) {
    return this.uow.transaction(async () => {
      const id = await (this.repo as MembersRepository).getMemberIdByProfileId(profileId);
      return { id };
    });
  }

  async updateMember(id: string, b: UpdateMemberDto) {
    return this.uow.transaction(async () => {
      const repo = this.repo as MembersRepository;

      await repo.updateColumns('profiles', b.profile_id, MembersMapper.toProfilePatch(b));

      const memberSet = MembersMapper.toMemberPatch(b);
      if (Object.keys(memberSet).length) await repo.updateColumns('members', id, memberSet);

      return { ok: true };
    });
  }

  async deleteByProfile(caller: Caller, profileId: string) {
    return this.uow.transaction(async () => {
      const memberId = await (this.repo as MembersRepository).getMemberIdByProfileId(profileId);
      if (memberId) {
        const { requireMember } = await import('../../common/auth/access.service.js');
        await requireMember((this.repo as any).db, caller, memberId);
      }
      await (this.repo as MembersRepository).deleteProfile(profileId);
    });
  }

  /**
   * Translate once, here — so no controller has to know a schema name, and no
   * snake_case key can reach Drizzle to be quietly discarded.
   */
  async bulkUpdate(filters: MemberFilters, patch: MemberFieldPatch) {
    const columns = MembersMapper.toMemberPatch(patch);
    if (!Object.keys(columns).length) return { affected: 0 };
    return this.uow.transaction(async () => {
      return (this.repo as MembersRepository).bulkUpdateMembers(filters, columns);
    });
  }

  async bulkDelete(filters: MemberFilters) {
    return this.uow.transaction(async () => {
      return (this.repo as MembersRepository).bulkDeleteProfiles(filters);
    });
  }
}
