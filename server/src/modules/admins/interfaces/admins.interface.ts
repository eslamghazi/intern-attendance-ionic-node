import type { JwtClaims } from '../../../db/context.js';
import type { IBaseService } from '../../../common/database/interfaces/base-service.interface.js';
import type { IGenericRepository } from '../../../common/database/interfaces/generic-repository.interface.js';
import { profiles } from '../../../db/schema/index.js';
import type { AdminDto, AdminAssignmentResponseDto, UpdateAdminDto } from '../dto/admin.dto.js';

export interface IAdminsService extends IBaseService<
  typeof profiles.$inferSelect,
  string,
  typeof profiles.$inferInsert,
  Partial<typeof profiles.$inferInsert>,
  AdminDto
> {
  getAdmins(claims: JwtClaims): Promise<AdminDto[]>;
  getAssignments(claims: JwtClaims): Promise<AdminAssignmentResponseDto[]>;
  updateAdmin(claims: JwtClaims, id: string, b: UpdateAdminDto): Promise<{ ok: true }>;
  createAssignment(
    claims: JwtClaims,
    adminId: string,
    groupId: string | null,
    branchId: string | null,
  ): Promise<AdminAssignmentResponseDto>;
  deleteAssignment(claims: JwtClaims, id: string): Promise<void>;
}

export interface IAdminsRepository extends IGenericRepository<
  typeof profiles.$inferSelect,
  string,
  typeof profiles.$inferInsert,
  Partial<typeof profiles.$inferInsert>
> {
  getAdmins(): Promise<any[]>;
  getAssignments(): Promise<any[]>;
  updateAdmin(id: string, patch: Record<string, unknown>): Promise<{ id: string } | null>;
  createAssignment(adminId: string, groupId: string | null, branchId: string | null): Promise<{ id: string } | null>;
  deleteAssignment(id: string): Promise<{ id: string } | null>;
}
