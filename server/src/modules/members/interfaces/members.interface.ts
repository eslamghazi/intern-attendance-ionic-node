import type { Caller } from '../../../common/types.js';
import type { JwtClaims } from '../../../db/context.js';
import type { MemberFilters } from '../../../domain/member/filter.js';
import type { IBaseService } from '../../../common/database/interfaces/base-service.interface.js';
import type { IGenericRepository } from '../../../common/database/interfaces/generic-repository.interface.js';
import { members } from '../../../db/schema/index.js';
import type {
  MemberDto,
  MemberDirectoryRowDto,
  MemberPageItemDto,
  FlagStatsResponseDto,
  UpdateMemberDto,
  MemberByProfileDto,
} from '../dto/member.dto.js';
import type { MemberInput, ItemResult, DirectoryRow, MemberPageItem } from '../members.repository.js';

export interface IMembersService extends IBaseService<
  typeof members.$inferSelect,
  string,
  typeof members.$inferInsert,
  Partial<typeof members.$inferInsert>,
  MemberDto
> {
  createMembers(caller: Caller, items: MemberInput[]): Promise<{
    created: number;
    updated: number;
    total: number;
    results: ItemResult[];
  }>;
  getNationalIds(claims: JwtClaims): Promise<string[]>;
  getMembers(claims: JwtClaims, filters: MemberFilters, pageSize: number, offset: number): Promise<{
    rows: MemberDirectoryRowDto[];
    total: number;
  }>;
  getMembersPage(claims: JwtClaims, filters: MemberFilters, pageSize: number, offset: number): Promise<{
    items: MemberPageItemDto[];
    total: number;
  }>;
  getFlagStats(claims: JwtClaims, filters: MemberFilters): Promise<FlagStatsResponseDto>;
  getCountActive(claims: JwtClaims): Promise<{ count: number }>;
  getByProfile(claims: JwtClaims, profileId: string): Promise<MemberByProfileDto>;
  updateMember(claims: JwtClaims, id: string, b: UpdateMemberDto): Promise<{ ok: boolean }>;
  deleteByProfile(caller: Caller, claims: JwtClaims, profileId: string): Promise<void>;
  bulkUpdate(claims: JwtClaims, filters: MemberFilters, patch: Record<string, unknown>): Promise<{ affected: number }>;
  bulkDelete(claims: JwtClaims, filters: MemberFilters): Promise<{ affected: number }>;
}

export interface IMembersRepository extends IGenericRepository<
  typeof members.$inferSelect,
  string,
  typeof members.$inferInsert,
  Partial<typeof members.$inferInsert>
> {
  getFrozenAt(profileId: string): Promise<Date | null>;
  updateColumns(table: 'profiles' | 'members', id: string, patch: Record<string, unknown>): Promise<void>;
  upsertMember(callerId: string, input: MemberInput): Promise<ItemResult>;
  getNationalIds(): Promise<string[]>;
  getMembersDirectory(filters: MemberFilters, limit: number, offset: number): Promise<Array<DirectoryRow & { total: string }>>;
  getMembersPage(filters: MemberFilters, limit: number, offset: number): Promise<Array<MemberPageItem & { total: string }>>;
  getFlagStats(filters: MemberFilters): Promise<{
    total: number;
    bypass_face: number;
    bypass_location: number;
    frozen: number;
  }>;
  getCountActive(): Promise<{ count: number }>;
  getMemberIdByProfileId(profileId: string): Promise<string | null>;
  deleteProfile(profileId: string): Promise<void>;
  bulkUpdateMembers(filters: MemberFilters, patch: Record<string, unknown>): Promise<{ affected: number }>;
  bulkDeleteProfiles(filters: MemberFilters): Promise<{ affected: number }>;
}
