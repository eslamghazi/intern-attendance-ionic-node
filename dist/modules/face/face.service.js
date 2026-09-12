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
import { AuditService } from '../audit/audit.service.js';
import { facePath } from '../../infrastructure/storage/paths.js';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { FaceRepository } from './face.repository.js';
import { FileManager } from '../../infrastructure/storage/file-manager.service.js';
import { requireMember, requireSelfOrMember } from '../../common/auth/access.service.js';
import { isStaff } from '../../domain/identity/role.js';
import { badRequest, forbidden, notFound } from '../../common/errors.js';
import { MembersRepository } from '../members/members.repository.js';
import { Role, AuditEvent } from '../../common/enums/index.js';
let FaceService = class FaceService {
    uow;
    repo;
    membersRepo;
    fileManager;
    audit;
    constructor(uow, repo, membersRepo, fileManager, audit) {
        this.uow = uow;
        this.repo = repo;
        this.membersRepo = membersRepo;
        this.fileManager = fileManager;
        this.audit = audit;
    }
    async clearEnrolment(memberId, profileId) {
        const photoPath = await this.repo.getTemplatePhotoPath(memberId);
        await this.repo.deleteTemplate(memberId);
        await this.repo.setEnrollmentPending(memberId);
        const paths = [`${profileId}/reference.jpg`];
        if (photoPath)
            paths.push(photoPath);
        // Note: removeObjects takes tx from context but since we are refactoring, we must pass it explicitly or it grabs it from ALS automatically
        // The previous code passed tx. We can just call removeObjects without tx if it's using the global db or context
        // Actually, removeObjects supports an optional tx parameter. Since we use ALS, we can pass nothing or the uow proxy.
        // wait, we can pass (this.repo as any).db as tx.
        await this.fileManager.delete('faces', paths, this.repo.db);
    }
    async resolveScope(caller) {
        if (caller.role === Role.ADMIN || caller.role === Role.SUPERADMIN)
            return { branchId: null };
        if (caller.role !== Role.MEMBER)
            throw forbidden();
        const scope = await this.repo.getMemberScope(caller.id);
        if (!scope?.canResetFace)
            throw forbidden();
        return { branchId: scope.branchId };
    }
    async enrollPhoto(caller, base64) {
        const bytes = this.fileManager.decodeBase64Image(base64);
        if (!bytes)
            throw badRequest('bad_base64', 'could not decode the image');
        return this.uow.transaction(async () => {
            const storeFaceImages = await this.repo.getSettingsStoreFaceImages();
            if (!storeFaceImages)
                return { ok: true, skipped: true };
            const member = await this.repo.getMemberDirectoryByProfileId(caller.id);
            if (!member)
                throw notFound('member_not_found');
            if (!member.member_id)
                throw notFound('member_not_found');
            // year-2026/branch-…/group-…/member-2026010001/face.jpg
            // A fixed leaf name, so re-enrolling REPLACES the photo instead of
            // leaving a second file nothing points at. See paths.ts.
            const path = facePath({
                groupYear: member.group_year,
                branchName: member.branch_name,
                groupName: member.group_name,
                memberCode: member.member_code ?? member.national_id,
            });
            await this.fileManager.upload({
                kind: 'faces',
                path,
                body: bytes,
                contentType: 'image/jpeg',
                owner: caller.id,
                // The photo is OF this member; that is what decides who may read it.
                subject: caller.id,
                tx: this.repo.db,
            });
            await this.repo.updateTemplatePhotoPath(member.member_id, path);
            return { ok: true, path };
        });
    }
    async resetFace(caller, memberId) {
        return this.uow.transaction(async () => {
            await requireMember(this.repo.db, caller, memberId);
            const memberProfile = await this.repo.getMemberProfileScope(memberId);
            if (!memberProfile)
                throw notFound('member_not_found');
            await this.clearEnrolment(memberId, memberProfile.profileId);
            return { ok: true };
        });
    }
    async lookup(caller, code) {
        return this.uow.transaction(async () => {
            const { branchId } = await this.resolveScope(caller);
            const row = await this.repo.getMemberDirectoryByCodeAndBranch(code, branchId);
            if (!row)
                return { found: false };
            return {
                found: true,
                member_id: row.member_id,
                member_code: row.member_code,
                full_name: row.full_name,
                enrolled: Boolean(row.has_face),
            };
        });
    }
    /**
     * The enrolled embedding. A member reads their own; staff read within scope.
     *
     * This is the biometric a check-in is matched against, so handing it to the
     * wrong caller hands them what they need to impersonate that member offline.
     */
    async getTemplate(caller, memberId) {
        return this.uow.transaction(async (tx) => {
            await requireSelfOrMember(tx, caller, memberId);
            const embedding = await this.repo.getTemplateEmbedding(memberId);
            return { embedding };
        });
    }
    /**
     * Enrol (or replace) the face a member is matched against.
     *
     * THE MOST DANGEROUS WRITE IN THE SYSTEM, and it had no check at all: it took
     * a memberId from the URL and wrote whatever embedding the body carried. A
     * member could enrol THEIR OWN face as SOMEBODY ELSE's template and then walk
     * through that person's check-in — attendance fraud with no forged document
     * and nothing in the record to show for it beyond this one audit row.
     */
    async putTemplate(caller, memberId, b) {
        return this.uow.transaction(async (tx) => {
            await requireSelfOrMember(tx, caller, memberId);
            await this.repo.upsertTemplate(memberId, b.embedding, b.photo_path ?? null, b.quality_score ?? null);
            // Enrolling a face REPLACES the biometric a member is matched against
            // from then on, so it decides who can check in as them from that moment.
            // It has the longest reach of any single act in the system, which is
            // exactly why it is audited.
            await this.audit.record(caller.id, AuditEvent.FACE_ENROLLED, {
                member_id: memberId,
                // The embedding itself is never recorded: it is the biometric.
                quality_score: b.quality_score ?? null,
                replaced: true,
            });
            return { ok: true };
        });
    }
    async getTemplatePhotos(memberIds) {
        if (!memberIds.length)
            return [];
        return this.uow.transaction(async () => {
            return this.repo.getTemplatesForMembers(memberIds);
        });
    }
    async getTemplatePhotoPaths() {
        return this.uow.transaction(async () => {
            const rows = await this.repo.getAllPhotoPaths();
            return rows.map((r) => r.photo_path);
        });
    }
    async toolReset(caller, memberId) {
        return this.uow.transaction(async () => {
            const { branchId } = await this.resolveScope(caller);
            const member = await this.repo.getMemberProfileScope(memberId);
            if (!member)
                throw notFound('member_not_found');
            if (branchId && member.branchId !== branchId)
                throw forbidden();
            if (isStaff(caller.role)) {
                await requireMember(this.repo.db, caller, memberId);
            }
            await this.clearEnrolment(memberId, member.profileId);
            return { ok: true };
        });
    }
};
FaceService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        FaceRepository,
        MembersRepository,
        FileManager,
        AuditService])
], FaceService);
export { FaceService };
//# sourceMappingURL=face.service.js.map