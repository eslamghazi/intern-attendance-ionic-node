import type { Caller } from '../../../common/types.js';
import type { JwtClaims } from '../../../infrastructure/database/context.js';
import type { MemberFilters } from '../../../domain/member/filter.js';
import type { IBaseService } from '../../../infrastructure/database/interfaces/base-service.interface.js';
import type { IGenericRepository } from '../../../infrastructure/database/interfaces/generic-repository.interface.js';
import { members } from '../../../infrastructure/database/schema/index.js';
import type {
  MemberDto,
  MemberDirectoryRowDto,
  MemberPageItemDto,
  FlagStatsResponseDto,
  UpdateMemberDto,
  MemberByProfileDto,
} from '../dto/member.dto.js';
import type { MemberInput, ItemResult, DirectoryRow, MemberPageItem } from '../members.repository.js';
import type { MemberFieldPatch, MemberPatch, ProfilePatch } from '../members.types.js';

export interface IMembersService extends IBaseService<typeof members, MemberDto> {
  createMembers(caller: Caller, items: MemberInput[]): Promise<{
    created: number;
    updated: number;
    total: number;
    results: ItemResult[];
  }>;
  getNationalIds(): Promise<string[]>;
  getMembers(filters: MemberFilters, pageSize: number, offset: number): Promise<{
    rows: MemberDirectoryRowDto[];
    total: number;
  }>;
  getMembersPage(filters: MemberFilters, pageSize: number, offset: number): Promise<{
    items: MemberPageItemDto[];
    total: number;
  }>;
  getFlagStats(filters: MemberFilters): Promise<FlagStatsResponseDto>;
  getCountActive(): Promise<{ count: number }>;
  getByProfile(profileId: string): Promise<MemberByProfileDto>;
  updateMember(id: string, b: UpdateMemberDto): Promise<{ ok: boolean }>;
  deleteByProfile(caller: Caller, profileId: string): Promise<void>;
  bulkUpdate(filters: MemberFilters, patch: MemberFieldPatch): Promise<{ affected: number }>;
  bulkDelete(filters: MemberFilters): Promise<{ affected: number }>;
}

export interface IMembersRepository extends IGenericRepository<typeof members> {
  getFrozenAt(profileId: string): Promise<Date | null>;
  updateColumns(table: 'profiles' | 'members', id: string, patch: ProfilePatch | MemberPatch): Promise<void>;
  upsertMember(callerId: string, input: MemberInput): Promise<ItemResult>;
  getNationalIds(): Promise<string[]>;
  getMembersDirectory(filters: MemberFilters, limit: number, offset: number): Promise<{ rows: DirectoryRow[]; total: number }>;
  getMembersPage(filters: MemberFilters, limit: number, offset: number): Promise<{ items: MemberPageItem[]; total: number }>;
  getFlagStats(filters: MemberFilters): Promise<{
    total: number;
    bypass_face: number;
    bypass_location: number;
    frozen: number;
  }>;
  getCountActive(): Promise<{ count: number }>;
  getMemberIdByProfileId(profileId: string): Promise<string | null>;
  deleteProfile(profileId: string): Promise<void>;
  bulkUpdateMembers(filters: MemberFilters, patch: MemberPatch): Promise<{ affected: number }>;
  bulkDeleteProfiles(filters: MemberFilters): Promise<{ affected: number }>;
}
