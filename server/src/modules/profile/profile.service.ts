import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { ProfileRepository, ProfileEdit } from './profile.repository.js';
import type { Caller } from '../../domain/identity/role.js';
import { conflict } from '../../http/errors.js';
import type { JwtClaims } from '../../db/context.js';

@Injectable()
export class ProfileService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: ProfileRepository,
  ) {}

  async markEnrolled(caller: Caller): Promise<void> {
    return this.uow.asService(async () => {
      await this.repo.markEnrolled(caller.id);
    });
  }

  async markPasswordChanged(caller: Caller): Promise<void> {
    return this.uow.asService(async () => {
      await this.repo.markPasswordChanged(caller.id);
    });
  }

  async updateOwnProfile(caller: Caller, edit: ProfileEdit): Promise<void> {
    return this.uow.asService(async () => {
      if (edit.nationalId) {
        const taken = await this.repo.isNationalIdTaken(edit.nationalId, caller.id);
        if (taken) throw conflict('national_id_taken', 'that national id is already in use');
      }

      await this.repo.updateOwnProfile(caller.id, edit);
    });
  }

  async getMemberCode(claims: JwtClaims, callerId: string): Promise<{ code: string | null }> {
    return this.uow.asCaller(claims, async () => {
      const code = await this.repo.getMemberCode(callerId);
      return { code };
    });
  }
}
