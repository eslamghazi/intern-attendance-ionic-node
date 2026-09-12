import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../infrastructure/database/generic.repository.js';
import { EMBEDDING_DIM, isEmbedding } from '../../domain/face/similarity.js';
import { badRequest } from '../../common/errors.js';
import { faceTemplates, members, memberDirectory, appSettings } from '../../infrastructure/database/schema/index.js';
import { eq, inArray, isNotNull, and } from 'drizzle-orm';
import { EnrollmentStatus } from '../../common/enums/index.js';

import type { IFaceRepository } from './interfaces/face.interface.js';
import type { JsonValue } from '../../common/json.types.js';


/**
 * The `[0.1,0.2,…]` the client posts, into the numbers the column stores.
 *
 * Throws rather than truncating or padding: an embedding of the wrong length is
 * a bug in whatever produced it, and storing it anyway would quietly make every
 * later face comparison against this member meaningless — a failure that shows
 * up weeks later as "the app stopped recognising me".
 */
function parseEmbedding(value: string): number[] {
  let parsed: JsonValue;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw badRequest('bad_embedding', 'the embedding is not valid JSON');
  }

  if (!isEmbedding(parsed)) {
    const shape = Array.isArray(parsed) ? `an array of ${parsed.length}` : typeof parsed;
    throw badRequest(
      'bad_embedding',
      `expected ${EMBEDDING_DIM} finite numbers, got ${shape}`,
    );
  }
  return parsed;
}

@Injectable()
export class FaceRepository extends GenericRepository<typeof faceTemplates> implements IFaceRepository {
  constructor() {
    super(faceTemplates, faceTemplates.memberId);
  }

  async getSettingsStoreFaceImages() {
    const rows = await this.db
      .select({ storeFaceImages: appSettings.storeFaceImages })
      .from(appSettings)
      .where(eq(appSettings.id, 1));
    return rows[0]?.storeFaceImages ?? false;
  }

  async getMemberDirectoryByProfileId(profileId: string) {
    const rows = await this.db
      .select({
        member_id: memberDirectory.memberId,
        group_year: memberDirectory.groupYear,
        member_code: memberDirectory.memberCode,
        national_id: memberDirectory.nationalId,
        // For the enrolment photo's path — see infrastructure/storage/paths.ts.
        branch_name: memberDirectory.branchName,
        group_name: memberDirectory.groupName,
      })
      .from(memberDirectory)
      .where(eq(memberDirectory.profileId, profileId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getMemberDirectoryByCodeAndBranch(code: string, branchId: string | null) {
    const query = this.db
      .select({
        member_id: memberDirectory.memberId,
        member_code: memberDirectory.memberCode,
        full_name: memberDirectory.fullName,
        has_face: memberDirectory.hasFace,
      })
      .from(memberDirectory)
      .where(
        branchId
          ? and(
              eq(memberDirectory.memberCode, code),
              eq(memberDirectory.branchId, branchId),
            )
          : eq(memberDirectory.memberCode, code),
      )
      .limit(1);
      
    const rows = await query;
    return rows[0] ?? null;
  }

  async getTemplatePhotoPath(memberId: string) {
    const rows = await this.db
      .select({ photoPath: faceTemplates.photoPath })
      .from(faceTemplates)
      .where(eq(faceTemplates.memberId, memberId))
      .limit(1);
    return rows[0]?.photoPath ?? null;
  }

  async deleteTemplate(memberId: string) {
    await this.db.delete(faceTemplates).where(eq(faceTemplates.memberId, memberId));
  }

  async setEnrollmentPending(memberId: string) {
    await this.db
      .update(members)
      .set({ enrollmentStatus: EnrollmentStatus.PENDING })
      .where(eq(members.id, memberId));
  }

  async updateTemplatePhotoPath(memberId: string, path: string) {
    await this.db
      .update(faceTemplates)
      .set({ photoPath: path })
      .where(eq(faceTemplates.memberId, memberId));
  }

  async getMemberScope(profileId: string) {
    const rows = await this.db
      .select({ branchId: members.branchId, canResetFace: members.canResetFace })
      .from(members)
      .where(eq(members.profileId, profileId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getMemberProfileScope(memberId: string) {
    const rows = await this.db
      .select({ profileId: members.profileId, branchId: members.branchId })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getTemplateEmbedding(memberId: string) {
    const rows = await this.db
      .select({ embedding: faceTemplates.embedding })
      .from(faceTemplates)
      .where(eq(faceTemplates.memberId, memberId))
      .limit(1);
    return rows[0]?.embedding ?? null;
  }

  /**
   * Store a member's enrolment embedding.
   *
   * Parsed to numbers before it goes near the query, so the column's own type
   * does the serialising and a wrong shape is a validation error the client can
   * act on rather than a database error at insert time.
   */
  async upsertTemplate(memberId: string, embeddingStr: string, photoPath: string | null, qualityScore: number | null) {
    const embedding = parseEmbedding(embeddingStr);

    await this.db
      .insert(faceTemplates)
      .values({ memberId, embedding, photoPath, qualityScore })
      .onConflictDoUpdate({
        target: faceTemplates.memberId,
        set: { embedding, photoPath, qualityScore },
      });
  }

  async getTemplatesForMembers(memberIds: string[]) {
    return this.db
      .select({
        member_id: faceTemplates.memberId,
        photo_path: faceTemplates.photoPath,
        created_at: faceTemplates.createdAt,
      })
      .from(faceTemplates)
      .where(inArray(faceTemplates.memberId, memberIds));
  }

  async getAllPhotoPaths() {
    return this.db
      .select({ photo_path: faceTemplates.photoPath })
      .from(faceTemplates)
      .where(isNotNull(faceTemplates.photoPath));
  }
}
