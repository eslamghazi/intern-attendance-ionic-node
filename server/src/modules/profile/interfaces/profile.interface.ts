import type { Caller } from '../../../domain/identity/role.js';
import type { JwtClaims } from '../../../infrastructure/database/context.js';
import type { IBaseService } from '../../../infrastructure/database/interfaces/base-service.interface.js';
import type { IGenericRepository } from '../../../infrastructure/database/interfaces/generic-repository.interface.js';
import { profiles } from '../../../infrastructure/database/schema/index.js';
import type { ProfileEdit } from '../profile.repository.js';
import type { ProfileResponseDto } from '../dto/profile.dto.js';

export interface IProfileService extends IBaseService<typeof profiles, ProfileResponseDto> {
  markEnrolled(caller: Caller): Promise<void>;
  updateOwnProfile(caller: Caller, edit: ProfileEdit): Promise<void>;
  getMemberCode(callerId: string): Promise<{ code: string | null }>;
}

export interface IProfileRepository extends IGenericRepository<typeof profiles> {
  markEnrolled(profileId: string): Promise<void>;
  isNationalIdTaken(nationalId: string, excludeProfileId: string): Promise<boolean>;
  updateOwnProfile(profileId: string, edit: ProfileEdit): Promise<void>;
  getMemberCode(profileId: string): Promise<string | null>;
}
