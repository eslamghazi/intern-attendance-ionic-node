import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { AdminsRepository } from './admins.repository.js';
import { notFound } from '../../http/errors.js';
import type { JwtClaims } from '../../db/context.js';
import { BaseService } from '../../common/database/base.service.js';
import { profiles } from '../../db/schema/index.js';
import { AdminDto, AdminAssignmentResponseDto, UpdateAdminDto } from './dto/admin.dto.js';
import { AdminsMapper } from './admins.mapper.js';

@Injectable()
export class AdminsService extends BaseService<
  typeof profiles.$inferSelect,
  string,
  typeof profiles.$inferInsert,
  Partial<typeof profiles.$inferInsert>,
  AdminDto
> {
  constructor(
    uow: UnitOfWorkService,
    repo: AdminsRepository,
  ) {
    super(uow, repo);
  }

  protected mapToResponse(entity: any): AdminDto {
    return AdminsMapper.toDto(entity);
  }

  async getAdmins(claims: JwtClaims): Promise<AdminDto[]> {
    return this.uow.asCaller(claims, async () => {
      const rows = await (this.repo as AdminsRepository).getAdmins();
      return AdminsMapper.toList(rows);
    });
  }

  async getAssignments(claims: JwtClaims): Promise<AdminAssignmentResponseDto[]> {
    return this.uow.asCaller(claims, async () => {
      const rows = await (this.repo as AdminsRepository).getAssignments();
      return AdminsMapper.toAssignmentList(rows);
    });
  }

  async updateAdmin(claims: JwtClaims, id: string, b: UpdateAdminDto): Promise<{ ok: true }> {
    return this.uow.asCaller(claims, async () => {
      const patch: Record<string, unknown> = {
        fullName: b.full_name,
        nationalId: b.national_id,
        phone: b.phone || null,
      };
      if (b.permissions !== undefined) {
        patch.permissions = b.permissions;
      }

      const updated = await (this.repo as AdminsRepository).updateAdmin(id, patch);
      if (!updated) throw notFound();
      return { ok: true };
    });
  }

  async createAssignment(
    claims: JwtClaims,
    adminId: string,
    groupId: string | null,
    branchId: string | null,
  ): Promise<AdminAssignmentResponseDto> {
    return this.uow.asCaller(claims, async () => {
      const created = await (this.repo as AdminsRepository).createAssignment(adminId, groupId, branchId);
      if (!created) throw notFound();
      return AdminsMapper.toAssignmentDto(created);
    });
  }

  async deleteAssignment(claims: JwtClaims, id: string): Promise<void> {
    return this.uow.asCaller(claims, async () => {
      const deleted = await (this.repo as AdminsRepository).deleteAssignment(id);
      if (!deleted) throw notFound();
    });
  }
}
