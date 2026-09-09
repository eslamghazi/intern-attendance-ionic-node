import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { FaceRepository } from './face.repository.js';
import type { Caller } from '../../common/types.js';
import type { JwtClaims } from '../../db/context.js';
import { FileCategory, FileManager } from '../../infrastructure/storage/file-manager.service.js';
import { requireMember } from '../../common/auth/access.service.js';
import { isStaff } from '../../domain/identity/role.js';
import { badRequest, forbidden, notFound } from '../../http/errors.js';
import { MembersRepository } from '../members/members.repository.js';

function sanitize(s: string): string {
  return String(s ?? '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'x';
}

@Injectable()
export class FaceService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: FaceRepository,
    private readonly membersRepo: MembersRepository,
    private readonly fileManager: FileManager,
  ) {}

  private async clearEnrolment(memberId: string, profileId: string): Promise<void> {
    const photoPath = await this.repo.getTemplatePhotoPath(memberId);
    
    await this.repo.deleteTemplate(memberId);
    await this.repo.setEnrollmentPending(memberId);

    const paths = [`${profileId}/reference.jpg`];
    if (photoPath) paths.push(photoPath);
    // Note: removeObjects takes tx from context but since we are refactoring, we must pass it explicitly or it grabs it from ALS automatically
    // The previous code passed tx. We can just call removeObjects without tx if it's using the global db or context
    // Actually, removeObjects supports an optional tx parameter. Since we use ALS, we can pass nothing or the uow proxy.
    // wait, we can pass (this.repo as any).db as tx.
    await this.fileManager.delete(FileCategory.FACE, paths, (this.repo as any).db);
  }

  private async resolveScope(caller: { id: string; role: string }): Promise<{ branchId: string | null }> {
    if (caller.role === 'admin' || caller.role === 'superadmin') return { branchId: null };
    if (caller.role !== 'member') throw forbidden();
    
    const scope = await this.repo.getMemberScope(caller.id);
    if (!scope?.canResetFace) throw forbidden();
    
    return { branchId: scope.branchId };
  }

  async enrollPhoto(caller: Caller, base64: string) {
    const bytes = this.fileManager.decodeBase64Image(base64);
    if (!bytes) throw badRequest('bad_base64', 'could not decode the image');

    return this.uow.asService(async () => {
      const storeFaceImages = await this.repo.getSettingsStoreFaceImages();
      if (!storeFaceImages) return { ok: true, skipped: true };

      const member = await this.repo.getMemberDirectoryByProfileId(caller.id);
      if (!member) throw notFound('member_not_found');

      const folder = member.group_year ? String(member.group_year) : 'group';
      const nationalIdOrEmpty = member.national_id || '';
      const path = `${folder}/${sanitize(member.member_code ?? nationalIdOrEmpty)}.jpg`;

      if (!member.member_id) throw notFound('member_not_found');

      await this.fileManager.upload({
        category: FileCategory.FACE,
        path,
        body: bytes,
        contentType: 'image/jpeg',
        owner: caller.id,
        tx: (this.repo as any).db,
      });

      await this.repo.updateTemplatePhotoPath(member.member_id, path);

      return { ok: true, path };
    });
  }

  async resetFace(caller: Caller, memberId: string) {
    return this.uow.asService(async () => {
      await requireMember((this.repo as any).db, caller, memberId);

      const memberProfile = await this.repo.getMemberProfileScope(memberId);
      if (!memberProfile) throw notFound('member_not_found');
      
      await this.clearEnrolment(memberId, memberProfile.profileId);
      
      return { ok: true };
    });
  }

  async lookup(caller: Caller, code: string) {
    return this.uow.asService(async () => {
      const { branchId } = await this.resolveScope(caller);
      
      const row = await this.repo.getMemberDirectoryByCodeAndBranch(code, branchId);
      if (!row) return { found: false };
      
      return {
        found: true,
        member_id: row.member_id,
        member_code: row.member_code,
        full_name: row.full_name,
        enrolled: Boolean(row.has_face),
      };
    });
  }

  async getTemplate(claims: JwtClaims, memberId: string) {
    return this.uow.asCaller(claims, async () => {
      const embedding = await this.repo.getTemplateEmbedding(memberId);
      return { embedding };
    });
  }

  async putTemplate(claims: JwtClaims, memberId: string, b: { embedding: string; photo_path?: string | null; quality_score?: number | null }) {
    return this.uow.asCaller(claims, async () => {
      await this.repo.upsertTemplate(memberId, b.embedding, b.photo_path ?? null, b.quality_score ?? null);
      return { ok: true };
    });
  }

  async getTemplatePhotos(claims: JwtClaims, memberIds: string[]) {
    if (!memberIds.length) return [];
    
    return this.uow.asCaller(claims, async () => {
      return this.repo.getTemplatesForMembers(memberIds);
    });
  }

  async getTemplatePhotoPaths(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      const rows = await this.repo.getAllPhotoPaths();
      return rows.map((r) => r.photo_path);
    });
  }

  async toolReset(caller: Caller, memberId: string) {
    return this.uow.asService(async () => {
      const { branchId } = await this.resolveScope(caller);
      
      const member = await this.repo.getMemberProfileScope(memberId);
      if (!member) throw notFound('member_not_found');
      
      if (branchId && member.branchId !== branchId) throw forbidden();
      
      if (isStaff(caller.role)) {
        await requireMember((this.repo as any).db, caller, memberId);
      }

      await this.clearEnrolment(memberId, member.profileId);
      return { ok: true };
    });
  }
}
