import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { AdminsRepository } from './admins.repository.js';
import { forbidden, notFound } from '../../common/errors.js';
import { mayManageStaff } from '../../domain/identity/role.js';
import type { JwtClaims } from '../../infrastructure/database/context.js';
import { BaseService } from '../../infrastructure/database/base.service.js';
import { profiles } from '../../infrastructure/database/schema/index.js';
import { AdminDto, AdminAssignmentResponseDto, UpdateAdminDto } from './dto/admin.dto.js';
import { AdminsMapper } from './admins.mapper.js';

import type { IAdminsService } from './interfaces/admins.interface.js';
import type { AdminPatch } from './admins.types.js';
import type { Caller } from '../../domain/identity/types.js';

@Injectable()
export class AdminsService extends BaseService<typeof profiles, AdminDto> implements IAdminsService {
  constructor(
    uow: UnitOfWorkService,
    repo: AdminsRepository,
  ) {
    super(uow, repo);
  }

  protected mapToResponse(entity: any): AdminDto {
    return AdminsMapper.toDto(entity);
  }

  /**
   * The staff accounts the caller manages — everyone but themselves.
   *
   * A superadmin's own row has nothing to do on this screen: it cannot be
   * granted pages (a superadmin holds them all), cannot be deleted by its
   * owner, and its password is changed from the profile, not here. Listing it
   * only offered ways to lock oneself out.
   */
  async getAdmins(caller: Caller): Promise<AdminDto[]> {
    return this.uow.transaction(async () => {
      const rows = await (this.repo as AdminsRepository).getAdmins(caller.id);
      return AdminsMapper.toList(rows);
    });
  }

  async getAssignments(): Promise<AdminAssignmentResponseDto[]> {
    return this.uow.transaction(async () => {
      const rows = await (this.repo as AdminsRepository).getAssignments();
      return AdminsMapper.toAssignmentList(rows);
    });
  }

  /**
   * The target must be the actor's to manage — see mayManageStaff. Read
   * inside the transaction, so the role checked is the role written against.
   */
  private async requireManageable(actor: Caller, targetId: string): Promise<void> {
    const role = await (this.repo as AdminsRepository).staffRole(targetId);
    if (!role) throw notFound();
    if (!mayManageStaff(actor, targetId, role)) {
      throw forbidden('not yours to manage');
    }
  }

  async updateAdmin(actor: Caller, id: string, b: UpdateAdminDto): Promise<{ ok: true }> {
    return this.uow.transaction(async () => {
      await this.requireManageable(actor, id);
      const patch: AdminPatch = {
        fullName: b.full_name,
        nationalId: b.national_id,
        phone: b.phone || null,
      };
      // `null` clears the grant and is a real edit; `undefined` is the caller
      // not mentioning permissions at all, which must leave them standing.
      if (b.permissions !== undefined) {
        patch.permissions = b.permissions;
      }

      const updated = await (this.repo as AdminsRepository).updateAdmin(id, patch);
      if (!updated) throw notFound();
      return { ok: true };
    });
  }

  async createAssignment(
    actor: Caller,
    adminId: string,
    groupId: string | null,
    branchId: string | null,
  ): Promise<AdminAssignmentResponseDto> {
    return this.uow.transaction(async () => {
      await this.requireManageable(actor, adminId);
      const created = await (this.repo as AdminsRepository).createAssignment(adminId, groupId, branchId);
      if (!created) throw notFound();
      return AdminsMapper.toAssignmentDto(created);
    });
  }

  async deleteAssignment(actor: Caller, id: string): Promise<void> {
    return this.uow.transaction(async () => {
      const owner = await (this.repo as AdminsRepository).assignmentOwner(id);
      if (!owner) throw notFound();
      if (!mayManageStaff(actor, owner.adminId, owner.role)) throw forbidden('not yours to manage');
      const deleted = await (this.repo as AdminsRepository).deleteAssignment(id);
      if (!deleted) throw notFound();
    });
  }
}
