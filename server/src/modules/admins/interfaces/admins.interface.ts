import type { JwtClaims } from '../../../infrastructure/database/context.js';
import type { IBaseService } from '../../../infrastructure/database/interfaces/base-service.interface.js';
import type { IGenericRepository } from '../../../infrastructure/database/interfaces/generic-repository.interface.js';
import { profiles } from '../../../infrastructure/database/schema/index.js';
import type { AdminDto, AdminAssignmentResponseDto, UpdateAdminDto } from '../dto/admin.dto.js';
import type { AdminPatch } from '../admins.types.js';
import type { Caller } from '../../../domain/identity/types.js';
import type { Role } from '../../../common/enums/index.js';

export interface IAdminsService extends IBaseService<typeof profiles, AdminDto> {
  getAdmins(caller: Caller): Promise<AdminDto[]>;
  getAssignments(): Promise<AdminAssignmentResponseDto[]>;
  updateAdmin(actor: Caller, id: string, b: UpdateAdminDto): Promise<{ ok: true }>;
  createAssignment(
    actor: Caller,
    adminId: string,
    groupId: string | null,
    branchId: string | null,
  ): Promise<AdminAssignmentResponseDto>;
  deleteAssignment(actor: Caller, id: string): Promise<void>;
}

export interface IAdminsRepository extends IGenericRepository<typeof profiles> {
  getAdmins(exceptId: string): Promise<any[]>;
  getAssignments(): Promise<any[]>;
  updateAdmin(id: string, patch: AdminPatch): Promise<{ id: string } | null>;
  createAssignment(adminId: string, groupId: string | null, branchId: string | null): Promise<{ id: string } | null>;
  deleteAssignment(id: string): Promise<{ id: string } | null>;
  assignmentOwner(id: string): Promise<{ adminId: string; role: Role } | null>;
  staffRole(id: string): Promise<Role | null>;
}
