import type { Caller } from '../../../domain/identity/role.js';
import type { JwtClaims } from '../../../db/context.js';
import type { IBaseService } from '../../../common/database/interfaces/base-service.interface.js';
import type { IGenericRepository } from '../../../common/database/interfaces/generic-repository.interface.js';
import { profiles } from '../../../db/schema/index.js';
import type { ProfileEdit } from '../profile.repository.js';

export interface IProfileService extends IBaseService<
  typeof profiles.$inferSelect,
  string,
  typeof profiles.$inferInsert,
  Partial<typeof profiles.$inferInsert>,
  any
> {
  markEnrolled(caller: Caller): Promise<void>;
  markPasswordChanged(caller: Caller): Promise<void>;
  updateOwnProfile(caller: Caller, edit: ProfileEdit): Promise<void>;
  getMemberCode(claims: JwtClaims, callerId: string): Promise<{ code: string | null }>;
}

export interface IProfileRepository extends IGenericRepository<
  typeof profiles.$inferSelect,
  string,
  typeof profiles.$inferInsert,
  Partial<typeof profiles.$inferInsert>
> {
  markEnrolled(profileId: string): Promise<void>;
  markPasswordChanged(profileId: string): Promise<void>;
  isNationalIdTaken(nationalId: string, excludeProfileId: string): Promise<boolean>;
  updateOwnProfile(profileId: string, edit: ProfileEdit): Promise<void>;
  getMemberCode(profileId: string): Promise<string | null>;
}
