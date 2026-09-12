import type { Caller } from '../../../domain/identity/role.js';
import type { JwtClaims } from '../../../infrastructure/database/context.js';
import type { IBaseService } from '../../../infrastructure/database/interfaces/base-service.interface.js';
import type { IGenericRepository } from '../../../infrastructure/database/interfaces/generic-repository.interface.js';
import { departments } from '../../../infrastructure/database/schema/index.js';
import type { DepartmentDto } from '../dto/department.dto.js';
import type { PutDepartmentPayload, PutMemberDepartmentPayload } from '../departments.service.js';

export interface IDepartmentsService extends IBaseService<typeof departments, DepartmentDto> {
  getDepartments(): Promise<DepartmentDto[]>;
  getDepartmentsOptions(branchId?: string): Promise<DepartmentDto[]>;
  putDepartment(caller: Caller, d: PutDepartmentPayload): Promise<{ ok: boolean; id?: string }>;
  deleteDepartment(caller: Caller, id: string): Promise<{ ok: boolean }>;
  getMemberDepartments(year: number, month: number): Promise<Record<string, string | null>>;
  putMemberDepartment(b: PutMemberDepartmentPayload): Promise<{ ok: boolean; cleared?: boolean }>;
}

export interface IDepartmentsRepository extends IGenericRepository<typeof departments> {
  getDepartments(): Promise<any[]>;
  getDepartmentsOptions(branchId?: string): Promise<any[]>;
  getDepartmentBranchId(id: string): Promise<{ branchId: string | null } | null>;
  upsertDepartment(id: string | undefined, name: string, branchId: string | null): Promise<{ id: string } | undefined>;
  deleteDepartment(id: string): Promise<{ id: string } | null>;
  getMemberDepartments(year: number, month: number): Promise<Record<string, string | null>>;
  deleteMemberDepartment(memberId: string, year: number, month: number): Promise<void>;
  upsertMemberDepartment(memberId: string, year: number, month: number, departmentId: string): Promise<void>;
}
