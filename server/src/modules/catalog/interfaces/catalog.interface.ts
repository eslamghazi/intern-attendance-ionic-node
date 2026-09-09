import type { JwtClaims } from '../../../db/context.js';
import type { IGenericRepository } from '../../../common/database/interfaces/generic-repository.interface.js';
import { institutions } from '../../../db/schema/index.js';
import type {
  BranchOptionResponseDto,
  BranchResponseDto,
  CreateBranchDto,
  CreateGroupDto,
  CreateInstitutionDto,
  CreateShiftDto,
  GroupOptionResponseDto,
  GroupResponseDto,
  InstitutionResponseDto,
  ShiftKeyOptionResponseDto,
  ShiftResponseDto,
  UpdateBranchDto,
  UpdateGroupDto,
  UpdateInstitutionDto,
  UpdateShiftDto,
} from '../dto/catalog.dto.js';

export interface ICatalogService {
  getInstitutions(claims: JwtClaims): Promise<InstitutionResponseDto[]>;
  createInstitution(claims: JwtClaims, data: CreateInstitutionDto): Promise<InstitutionResponseDto>;
  updateInstitution(claims: JwtClaims, id: string, data: UpdateInstitutionDto): Promise<InstitutionResponseDto>;
  deleteInstitution(claims: JwtClaims, id: string): Promise<void>;

  getBranches(claims: JwtClaims): Promise<BranchResponseDto[]>;
  getBranchesOptions(claims: JwtClaims): Promise<BranchOptionResponseDto[]>;
  createBranch(claims: JwtClaims, b: CreateBranchDto): Promise<BranchResponseDto>;
  updateBranch(claims: JwtClaims, id: string, b: UpdateBranchDto): Promise<BranchResponseDto>;
  deleteBranch(claims: JwtClaims, id: string): Promise<void>;

  getGroups(claims: JwtClaims): Promise<GroupResponseDto[]>;
  getGroupsOptions(claims: JwtClaims): Promise<GroupOptionResponseDto[]>;
  createGroup(claims: JwtClaims, g: CreateGroupDto): Promise<GroupResponseDto>;
  updateGroup(claims: JwtClaims, id: string, g: UpdateGroupDto): Promise<GroupResponseDto>;
  deleteGroup(claims: JwtClaims, id: string): Promise<void>;

  getShifts(claims: JwtClaims): Promise<ShiftResponseDto[]>;
  getShiftsKeys(claims: JwtClaims): Promise<ShiftKeyOptionResponseDto[]>;
  createShift(claims: JwtClaims, s: CreateShiftDto): Promise<ShiftResponseDto>;
  updateShift(claims: JwtClaims, id: string, s: UpdateShiftDto): Promise<ShiftResponseDto>;
  deleteShift(claims: JwtClaims, id: string): Promise<void>;
}

export interface ICatalogRepository extends IGenericRepository<
  typeof institutions.$inferSelect,
  string,
  typeof institutions.$inferInsert,
  Partial<typeof institutions.$inferInsert>
> {
  getInstitutions(): Promise<any[]>;
  insertInstitution(name: string, code: number): Promise<any>;
  updateInstitution(id: string, name: string, code: number): Promise<any>;
  deleteInstitution(id: string): Promise<any>;

  getBranches(): Promise<any[]>;
  getBranchesOptions(): Promise<any[]>;
  insertBranch(b: Record<string, any>): Promise<any>;
  updateBranch(id: string, b: Record<string, any>): Promise<any>;
  deleteBranch(id: string): Promise<any>;

  getGroups(): Promise<any[]>;
  getGroupsOptions(): Promise<any[]>;
  insertGroup(g: Record<string, any>): Promise<any>;
  updateGroup(id: string, g: Record<string, any>): Promise<any>;
  deleteGroup(id: string): Promise<any>;

  getShifts(): Promise<any[]>;
  getShiftsKeys(): Promise<any[]>;
  insertShift(s: Record<string, any>): Promise<any>;
  updateShift(id: string, s: Record<string, any>): Promise<any>;
  deleteShift(id: string): Promise<any>;
}
