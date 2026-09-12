var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { MembersRepository } from '../members/members.repository.js';
import { cairoDate, cairoTime } from '../../domain/clock.js';
let TimeService = class TimeService {
    uow;
    membersRepo;
    constructor(uow, membersRepo) {
        this.uow = uow;
        this.membersRepo = membersRepo;
    }
    async getNow(caller) {
        const real = new Date();
        let frozenAt = null;
        if (caller) {
            frozenAt = await this.uow.transaction(async () => {
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
};
TimeService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        MembersRepository])
], TimeService);
export { TimeService };
//# sourceMappingURL=time.service.js.map