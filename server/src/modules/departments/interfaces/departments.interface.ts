import type { Caller } from '../../../domain/identity/role.js';
import type { JwtClaims } from '../../../db/context.js';
import type { IBaseService } from '../../../common/database/interfaces/base-service.interface.js';
import type { IGenericRepository } from '../../../common/database/interfaces/generic-repository.interface.js';
import { departments } from '../../../db/schema/index.js';
import type { DepartmentDto } from '../dto/department.dto.js';
import type { PutDepartmentPayload, PutMemberDepartmentPayload } from '../departments.service.js';

export interface IDepartmentsService extends IBaseService<
  typeof departments.$inferSelect,
  string,
  typeof departments.$inferInsert,
  Partial<typeof departments.$inferInsert>,
  DepartmentDto
> {
  getDepartments(claims: JwtClaims): Promise<DepartmentDto[]>;
  getDepartmentsOptions(claims: JwtClaims, branchId?: string): Promise<DepartmentDto[]>;
  putDepartment(caller: Caller, claims: JwtClaims, d: PutDepartmentPayload): Promise<{ ok: boolean; id?: string }>;
  deleteDepartment(caller: Caller, claims: JwtClaims, id: string): Promise<{ ok: boolean }>;
  getMemberDepartments(claims: JwtClaims, year: number, month: number): Promise<Record<string, string | null>>;
  putMemberDepartment(claims: JwtClaims, b: PutMemberDepartmentPayload): Promise<{ ok: boolean; cleared?: boolean }>;
}

export interface IDepartmentsRepository extends IGenericRepository<
  typeof departments.$inferSelect,
  string,
  typeof departments.$inferInsert,
  Partial<typeof departments.$inferInsert>
> {
  getDepartments(): Promise<any[]>;
  getDepartmentsOptions(branchId?: string): Promise<any[]>;
  getDepartmentBranchId(id: string): Promise<{ branchId: string | null } | null>;
  upsertDepartment(id: string | undefined, name: string, branchId: string | null): Promise<{ id: string } | undefined>;
  deleteDepartment(id: string): Promise<{ id: string } | null>;
  getMemberDepartments(year: number, month: number): Promise<Record<string, string | null>>;
  deleteMemberDepartment(memberId: string, year: number, month: number): Promise<void>;
  upsertMemberDepartment(memberId: string, year: number, month: number, departmentId: string): Promise<void>;
}
