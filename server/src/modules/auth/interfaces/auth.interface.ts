import type { Caller } from '../../../common/types.js';
import type { LoginResult } from '../auth.service.js';
import type { Account, StoredToken } from '../auth.repository.js';
import type { IGenericRepository } from '../../../infrastructure/database/interfaces/generic-repository.interface.js';
import { profiles } from '../../../infrastructure/database/schema/index.js';
import type { Role } from '../../../common/enums/index.js';

import type { CreateStaffDto } from '../dto/auth.dto.js';
import type { MeResponse } from '../auth.types.js';
import type { JsonValue } from '../../../common/json.types.js';

export interface IAuthService {
  login(nationalId: string, password?: string, userAgent?: string | null): Promise<LoginResult>;
  refresh(refreshToken: string, userAgent?: string | null): Promise<LoginResult>;
  logout(refreshToken?: string | null): Promise<void>;
  logoutEverywhere(caller: Caller): Promise<{ revoked: number }>;
  getMe(caller: Caller): Promise<MeResponse>;
  changeOwnPassword(
    caller: Caller,
    current: string,
    next: string,
    userAgent?: string | null,
  ): Promise<{ access_token: string; refresh_token: string }>;
  resetPassword(
    caller: Caller,
    opts: { profileId?: string; nationalId?: string; expect: 'member' | 'staff'; password?: string },
  ): Promise<{ password: string }>;
  createStaff(caller: Caller, payload: CreateStaffDto): Promise<{ id: string; password: string }>;
  deleteStaff(caller: Caller, profileId: string): Promise<void>;
}

export interface IAuthRepository extends IGenericRepository<typeof profiles> {
  findAccountByNationalId(nationalId: string): Promise<Account | null>;
  findAccountById(id: string): Promise<Account | null>;
  getProfile(profileId: string): Promise<any>;
  getMemberProfile(profileId: string): Promise<any>;
  storePasswordHash(profileId: string, hash: string): Promise<number>;
  readMasterPasswordHash(): Promise<string | null>;
  writeMasterPasswordHash(hash: string | null): Promise<void>;
  audit(actorId: string | null, event: string, detail: JsonValue): Promise<void>;
  findTokenByHash(tokenHash: string): Promise<StoredToken | null>;
  insertToken(row: {
    profileId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
  }): Promise<void>;
  markTokenRotated(id: string): Promise<boolean>;
  revokeFamily(familyId: string): Promise<number>;
  revokeAllForProfile(profileId: string): Promise<number>;
  createStaff(
    actorId: string,
    profileId: string,
    input: {
      national_id: string;
      full_name: string;
      phone?: string | null;
      role: Role;
    },
    passwordHash: string,
  ): Promise<void>;
  createAdminAssignment(adminId: string, groupId: string | null, branchId: string | null): Promise<void>;
  deleteProfile(profileId: string): Promise<void>;
}
