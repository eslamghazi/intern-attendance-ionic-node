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
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { ProfileRepository } from './profile.repository.js';
import { conflict } from '../../http/errors.js';
import { BaseService } from '../../common/database/base.service.js';
let ProfileService = class ProfileService extends BaseService {
    constructor(uow, repo) {
        super(uow, repo);
    }
    mapToResponse(entity) {
        return {
            id: entity.id,
            full_name: entity.fullName,
            national_id: entity.nationalId,
            phone: entity.phone,
            email: entity.email,
            avatar_url: entity.avatarUrl,
        };
    }
    get profileRepo() {
        return this.repo;
    }
    async markEnrolled(caller) {
        return this.uow.asService(async () => {
            await this.profileRepo.markEnrolled(caller.id);
        });
    }
    async markPasswordChanged(caller) {
        return this.uow.asService(async () => {
            await this.profileRepo.markPasswordChanged(caller.id);
        });
    }
    async updateOwnProfile(caller, edit) {
        return this.uow.asService(async () => {
            if (edit.nationalId) {
                const taken = await this.profileRepo.isNationalIdTaken(edit.nationalId, caller.id);
                if (taken)
                    throw conflict('national_id_taken', 'that national id is already in use');
            }
            await this.profileRepo.updateOwnProfile(caller.id, edit);
        });
    }
    async getMemberCode(claims, callerId) {
        return this.uow.asCaller(claims, async () => {
            const code = await this.profileRepo.getMemberCode(callerId);
            return { code };
        });
    }
};
ProfileService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        ProfileRepository])
], ProfileService);
export { ProfileService };
//# sourceMappingURL=profile.service.js.map