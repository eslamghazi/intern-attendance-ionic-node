import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { ProfileRepository, ProfileEdit } from './profile.repository.js';
import type { Caller } from '../../domain/identity/role.js';
import { conflict } from '../../http/errors.js';
import type { JwtClaims } from '../../db/context.js';
import { BaseService } from '../../common/database/base.service.js';
import { profiles } from '../../db/schema/index.js';

import type { IProfileService } from './interfaces/profile.interface.js';

@Injectable()
export class ProfileService extends BaseService<
  typeof profiles.$inferSelect,
  string,
  typeof profiles.$inferInsert,
  Partial<typeof profiles.$inferInsert>,
  any
> implements IProfileService {
  constructor(
    uow: UnitOfWorkService,
    repo: ProfileRepository,
  ) {
    super(uow, repo);
  }

  protected mapToResponse(entity: any) {
    return entity;
  }


  private get profileRepo(): ProfileRepository {
    return this.repo as ProfileRepository;
  }

  async markEnrolled(caller: Caller): Promise<void> {
    return this.uow.asService(async () => {
      await this.profileRepo.markEnrolled(caller.id);
    });
  }

  async markPasswordChanged(caller: Caller): Promise<void> {
    return this.uow.asService(async () => {
      await this.profileRepo.markPasswordChanged(caller.id);
    });
  }

  async updateOwnProfile(caller: Caller, edit: ProfileEdit): Promise<void> {
    return this.uow.asService(async () => {
      if (edit.nationalId) {
        const taken = await this.profileRepo.isNationalIdTaken(edit.nationalId, caller.id);
        if (taken) throw conflict('national_id_taken', 'that national id is already in use');
      }

      await this.profileRepo.updateOwnProfile(caller.id, edit);
    });
  }

  async getMemberCode(claims: JwtClaims, callerId: string): Promise<{ code: string | null }> {
    return this.uow.asCaller(claims, async () => {
      const code = await this.profileRepo.getMemberCode(callerId);
      return { code };
    });
  }
}

