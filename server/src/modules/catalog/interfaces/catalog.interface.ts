import type { JwtClaims } from '../../../infrastructure/database/context.js';
import type { Caller } from '../../../common/types.js';
import type { IGenericRepository } from '../../../infrastructure/database/interfaces/generic-repository.interface.js';
import { institutions } from '../../../infrastructure/database/schema/index.js';
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
  getInstitutions(): Promise<InstitutionResponseDto[]>;
  createInstitution(data: CreateInstitutionDto): Promise<InstitutionResponseDto>;
  updateInstitution(id: string, data: UpdateInstitutionDto): Promise<InstitutionResponseDto>;
  deleteInstitution(id: string): Promise<void>;

  getBranches(): Promise<BranchResponseDto[]>;
  getBranchesOptions(caller: Caller): Promise<BranchOptionResponseDto[]>;
  createBranch(b: CreateBranchDto): Promise<BranchResponseDto>;
  updateBranch(id: string, b: UpdateBranchDto): Promise<BranchResponseDto>;
  deleteBranch(id: string): Promise<void>;

  getGroups(): Promise<GroupResponseDto[]>;
  getGroupsOptions(caller: Caller): Promise<GroupOptionResponseDto[]>;
  createGroup(g: CreateGroupDto): Promise<GroupResponseDto>;
  updateGroup(id: string, g: UpdateGroupDto): Promise<GroupResponseDto>;
  deleteGroup(id: string): Promise<void>;

  getShifts(): Promise<ShiftResponseDto[]>;
  getShiftsKeys(): Promise<ShiftKeyOptionResponseDto[]>;
  createShift(s: CreateShiftDto): Promise<ShiftResponseDto>;
  updateShift(id: string, s: UpdateShiftDto): Promise<ShiftResponseDto>;
  deleteShift(id: string): Promise<void>;
}

export interface ICatalogRepository extends IGenericRepository<typeof institutions> {
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
