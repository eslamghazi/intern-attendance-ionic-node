import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { MembersRepository } from '../members/members.repository.js';
import type { Caller } from '../../common/types.js';
import { cairoDate, cairoTime } from '../../domain/clock.js';
import type { ServerNow } from './time.controller.js';

@Injectable()
export class TimeService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly membersRepo: MembersRepository,
  ) {}

  async getNow(caller: Caller | null): Promise<ServerNow> {
    const real = new Date();
    let frozenAt: Date | null = null;

    if (caller) {
      frozenAt = await this.uow.asService(async () => {
        return this.membersRepo.getFrozenAt(caller.id);
      });
    }

    const effective = frozenAt ?? real;
    return {
      date: cairoDate(effective),
      time: cairoTime(effective),
      frozen: frozenAt !== null,
      real_date: cairoDate(real),
      real_time: cairoTime(real),
    };
  }
}
