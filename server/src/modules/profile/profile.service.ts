import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { ProfileRepository, ProfileEdit } from './profile.repository.js';
import type { Caller } from '../../domain/identity/role.js';
import { conflict } from '../../common/errors.js';
import type { JwtClaims } from '../../infrastructure/database/context.js';
import { BaseService } from '../../infrastructure/database/base.service.js';
import { profiles } from '../../infrastructure/database/schema/index.js';

import type { IProfileService } from './interfaces/profile.interface.js';
import { ProfileResponseDto } from './dto/profile.dto.js';

@Injectable()
export class ProfileService extends BaseService<typeof profiles, ProfileResponseDto> implements IProfileService {
  constructor(
    uow: UnitOfWorkService,
    repo: ProfileRepository,
  ) {
    super(uow, repo);
  }

  protected mapToResponse(entity: typeof profiles.$inferSelect): ProfileResponseDto {
    return {
      id: entity.id,
      full_name: entity.fullName,
      national_id: entity.nationalId,
      phone: entity.phone,
      email: entity.email,
      avatar_url: entity.avatarUrl,
    };
  }


  private get profileRepo(): ProfileRepository {
    return this.repo as ProfileRepository;
  }

  async markEnrolled(caller: Caller): Promise<void> {
    return this.uow.transaction(async () => {
      await this.profileRepo.markEnrolled(caller.id);
    });
  }

  async updateOwnProfile(caller: Caller, edit: ProfileEdit): Promise<void> {
    return this.uow.transaction(async () => {
      if (edit.nationalId) {
        const taken = await this.profileRepo.isNationalIdTaken(edit.nationalId, caller.id);
        if (taken) throw conflict('national_id_taken', 'that national id is already in use');
      }

      await this.profileRepo.updateOwnProfile(caller.id, edit);
    });
  }

  async getMemberCode(callerId: string): Promise<{ code: string | null }> {
    return this.uow.transaction(async () => {
      const code = await this.profileRepo.getMemberCode(callerId);
      return { code };
    });
  }
}

