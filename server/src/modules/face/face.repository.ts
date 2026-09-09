import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../common/database/generic.repository.js';
import { faceTemplates, members, memberDirectory, appSettings } from '../../db/schema/index.js';
import { eq, inArray, isNotNull, and, sql } from 'drizzle-orm';

@Injectable()
export class FaceRepository extends GenericRepository<
  typeof faceTemplates.$inferSelect,
  string,
  typeof faceTemplates.$inferInsert,
  Partial<typeof faceTemplates.$inferInsert>
> {
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
      .set({ enrollmentStatus: 'pending' })
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

  async upsertTemplate(memberId: string, embeddingStr: string, photoPath: string | null, qualityScore: number | null) {
    // Drizzle ORM doesn't natively map string vectors to the pgvector type cleanly in raw bindings without sql``
    // So we use sql\`${embeddingStr}::vector\` for the embedding field.
    await this.db
      .insert(faceTemplates)
      .values({
        memberId,
        embedding: sql`${embeddingStr}::vector` as any,
        photoPath,
        qualityScore,
      })
      .onConflictDoUpdate({
        target: faceTemplates.memberId,
        set: {
          embedding: sql`${embeddingStr}::vector` as any,
          photoPath,
          qualityScore,
        },
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
