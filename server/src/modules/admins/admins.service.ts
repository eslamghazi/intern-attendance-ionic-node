import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { AdminsRepository } from './admins.repository.js';
import { notFound } from '../../http/errors.js';
import type { JwtClaims } from '../../db/context.js';

@Injectable()
export class AdminsService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: AdminsRepository,
  ) {}

  async getAdmins(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getAdmins();
    });
  }

  async getAssignments(claims: JwtClaims) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getAssignments();
    });
  }

  async updateAdmin(claims: JwtClaims, id: string, b: any) {
    return this.uow.asCaller(claims, async () => {
      const patch: Record<string, unknown> = {
        fullName: b.full_name,
        nationalId: b.national_id,
        phone: b.phone || null,
      };
      if (b.permissions !== undefined) {
        patch.permissions = b.permissions;
      }

      const updated = await this.repo.updateAdmin(id, patch);
      if (!updated) throw notFound();
      return { ok: true };
    });
  }

  async createAssignment(claims: JwtClaims, adminId: string, groupId: string | null, branchId: string | null) {
    return this.uow.asCaller(claims, async () => {
      const created = await this.repo.createAssignment(adminId, groupId, branchId);
      if (!created) throw notFound(); // Or internal error
      return created;
    });
  }

  async deleteAssignment(claims: JwtClaims, id: string) {
    return this.uow.asCaller(claims, async () => {
      const deleted = await this.repo.deleteAssignment(id);
      if (!deleted) throw notFound();
    });
  }
}
