import type { Caller } from '../../../common/types.js';
import type { JwtClaims } from '../../../db/context.js';
import type { IGenericRepository } from '../../../common/database/interfaces/generic-repository.interface.js';
import { faceTemplates } from '../../../db/schema/index.js';

export interface IFaceService {
  enrollPhoto(caller: Caller, base64: string): Promise<{ ok: boolean; skipped?: boolean; path?: string }>;
  resetFace(caller: Caller, memberId: string): Promise<{ ok: boolean }>;
  lookup(caller: Caller, code: string): Promise<{
    found: boolean;
    member_id?: string | null;
    member_code?: string | null;
    full_name?: string | null;
    enrolled?: boolean;
  }>;
  getTemplate(claims: JwtClaims, memberId: string): Promise<{ embedding: unknown }>;
  putTemplate(
    claims: JwtClaims,
    memberId: string,
    b: { embedding: string; photo_path?: string | null; quality_score?: number | null },
  ): Promise<{ ok: boolean }>;
  getTemplatePhotos(claims: JwtClaims, memberIds: string[]): Promise<Array<{
    member_id: string;
    photo_path: string | null;
    created_at: string | null;
  }>>;
  getTemplatePhotoPaths(claims: JwtClaims): Promise<Array<string | null>>;
  toolReset(caller: Caller, memberId: string): Promise<{ ok: boolean }>;
}

export interface IFaceRepository extends IGenericRepository<
  typeof faceTemplates.$inferSelect,
  string,
  typeof faceTemplates.$inferInsert,
  Partial<typeof faceTemplates.$inferInsert>
> {
  getSettingsStoreFaceImages(): Promise<boolean>;
  getMemberDirectoryByProfileId(profileId: string): Promise<{
    member_id: string | null;
    group_year: number | null;
    member_code: string | null;
    national_id: string | null;
  } | null>;
  getMemberDirectoryByCodeAndBranch(code: string, branchId: string | null): Promise<{
    member_id: string | null;
    member_code: string | null;
    full_name: string | null;
    has_face: boolean | null;
  } | null>;
  getTemplatePhotoPath(memberId: string): Promise<string | null>;
  deleteTemplate(memberId: string): Promise<void>;
  setEnrollmentPending(memberId: string): Promise<void>;
  updateTemplatePhotoPath(memberId: string, path: string): Promise<void>;
  getMemberScope(profileId: string): Promise<{ branchId: string; canResetFace: boolean | null } | null>;
  getMemberProfileScope(memberId: string): Promise<{ profileId: string; branchId: string } | null>;
  getTemplateEmbedding(memberId: string): Promise<unknown>;
  upsertTemplate(memberId: string, embeddingStr: string, photoPath: string | null, qualityScore: number | null): Promise<void>;
  getTemplatesForMembers(memberIds: string[]): Promise<Array<{
    member_id: string;
    photo_path: string | null;
    created_at: string | null;
  }>>;
  getAllPhotoPaths(): Promise<Array<{ photo_path: string | null }>>;
}
