var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../common/database/generic.repository.js';
import { faceTemplates, members, memberDirectory, appSettings } from '../../db/schema/index.js';
import { eq, inArray, isNotNull, and, sql } from 'drizzle-orm';
import { EnrollmentStatus } from '../../common/enums/index.js';
let FaceRepository = class FaceRepository extends GenericRepository {
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
    async getMemberDirectoryByProfileId(profileId) {
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
    async getMemberDirectoryByCodeAndBranch(code, branchId) {
        const query = this.db
            .select({
            member_id: memberDirectory.memberId,
            member_code: memberDirectory.memberCode,
            full_name: memberDirectory.fullName,
            has_face: memberDirectory.hasFace,
        })
            .from(memberDirectory)
            .where(branchId
            ? and(eq(memberDirectory.memberCode, code), eq(memberDirectory.branchId, branchId))
            : eq(memberDirectory.memberCode, code))
            .limit(1);
        const rows = await query;
        return rows[0] ?? null;
    }
    async getTemplatePhotoPath(memberId) {
        const rows = await this.db
            .select({ photoPath: faceTemplates.photoPath })
            .from(faceTemplates)
            .where(eq(faceTemplates.memberId, memberId))
            .limit(1);
        return rows[0]?.photoPath ?? null;
    }
    async deleteTemplate(memberId) {
        await this.db.delete(faceTemplates).where(eq(faceTemplates.memberId, memberId));
    }
    async setEnrollmentPending(memberId) {
        await this.db
            .update(members)
            .set({ enrollmentStatus: EnrollmentStatus.PENDING })
            .where(eq(members.id, memberId));
    }
    async updateTemplatePhotoPath(memberId, path) {
        await this.db
            .update(faceTemplates)
            .set({ photoPath: path })
            .where(eq(faceTemplates.memberId, memberId));
    }
    async getMemberScope(profileId) {
        const rows = await this.db
            .select({ branchId: members.branchId, canResetFace: members.canResetFace })
            .from(members)
            .where(eq(members.profileId, profileId))
            .limit(1);
        return rows[0] ?? null;
    }
    async getMemberProfileScope(memberId) {
        const rows = await this.db
            .select({ profileId: members.profileId, branchId: members.branchId })
            .from(members)
            .where(eq(members.id, memberId))
            .limit(1);
        return rows[0] ?? null;
    }
    async getTemplateEmbedding(memberId) {
        const rows = await this.db
            .select({ embedding: faceTemplates.embedding })
            .from(faceTemplates)
            .where(eq(faceTemplates.memberId, memberId))
            .limit(1);
        return rows[0]?.embedding ?? null;
    }
    async upsertTemplate(memberId, embeddingStr, photoPath, qualityScore) {
        // Drizzle ORM doesn't natively map string vectors to the pgvector type cleanly in raw bindings without sql``
        // So we use sql\`${embeddingStr}::vector\` for the embedding field.
        await this.db
            .insert(faceTemplates)
            .values({
            memberId,
            embedding: sql `${embeddingStr}::vector`,
            photoPath,
            qualityScore,
        })
            .onConflictDoUpdate({
            target: faceTemplates.memberId,
            set: {
                embedding: sql `${embeddingStr}::vector`,
                photoPath,
                qualityScore,
            },
        });
    }
    async getTemplatesForMembers(memberIds) {
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
};
FaceRepository = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], FaceRepository);
export { FaceRepository };
//# sourceMappingURL=face.repository.js.map