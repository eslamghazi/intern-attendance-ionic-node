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
import { MembersRepository } from './members.repository.js';
import { coversUnit } from '../../domain/access/scope.js';
import { BaseService } from '../../common/database/base.service.js';
import { MembersMapper } from './members.mapper.js';
function toMemberRow(r) {
    return {
        id: r.member_id,
        profile_id: r.profile_id,
        group_id: r.group_id,
        branch_id: r.branch_id,
        is_active: r.is_active,
        bypass_face: r.bypass_face,
        bypass_location: r.bypass_location,
        bypass_checkout_window: r.bypass_checkout_window,
        frozen_at: r.frozen_at,
        can_generate_qr: r.can_generate_qr,
        can_make_roster: r.can_make_roster,
        can_reset_face: r.can_reset_face,
        enrolled: r.has_face,
        member_code: r.member_code,
        avatar_url: r.avatar_url,
        profile: {
            full_name: r.full_name,
            national_id: r.national_id,
            phone: r.phone,
            email: r.email,
        },
        group: r.group_name ? { name: r.group_name } : null,
        branch: r.branch_name ? { name: r.branch_name } : null,
    };
}
const MEMBER_COLUMNS = [
    'group_id',
    'branch_id',
    'is_active',
    'bypass_face',
    'bypass_location',
    'bypass_checkout_window',
    'frozen_at',
    'can_generate_qr',
    'can_make_roster',
    'can_reset_face',
];
let MembersService = class MembersService extends BaseService {
    constructor(uow, repo) {
        super(uow, repo);
    }
    mapToResponse(entity) {
        return MembersMapper.toDto(entity);
    }
    async createMembers(caller, items) {
        const { scopeOf } = await import('../../common/auth/access.service.js');
        // Explicitly type scope as any or the correct type to avoid TS2345
        const scope = await this.uow.asService(async () => scopeOf(this.repo.db, caller));
        const results = [];
        for (const item of items) {
            if (!coversUnit(scope, { branchId: item.branch_id, groupId: item.group_id })) {
                results.push({
                    national_id: item.national_id,
                    ok: false,
                    error: 'outside your assignments',
                });
                continue;
            }
            try {
                results.push(await this.uow.asService(async () => {
                    return this.repo.upsertMember(caller.id, item);
                }));
            }
            catch (err) {
                results.push({
                    national_id: item.national_id,
                    ok: false,
                    error: err.message,
                });
            }
        }
        return {
            created: results.filter((r) => r.ok && !r.updated).length,
            updated: results.filter((r) => r.ok && r.updated).length,
            total: results.length,
            results,
        };
    }
    async getNationalIds(claims) {
        return this.uow.asCaller(claims, async () => {
            return this.repo.getNationalIds();
        });
    }
    async getMembers(claims, filters, pageSize, offset) {
        return this.uow.asCaller(claims, async () => {
            const rows = await this.repo.getMembersDirectory(filters, pageSize, offset);
            return {
                rows: rows.map(toMemberRow),
                total: rows.length ? Number(rows[0].total) : 0,
            };
        });
    }
    async getMembersPage(claims, filters, pageSize, offset) {
        return this.uow.asCaller(claims, async () => {
            const rows = await this.repo.getMembersPage(filters, pageSize, offset);
            return {
                items: rows.map(({ total: _total, ...item }) => item),
                total: rows.length ? Number(rows[0].total) : 0,
            };
        });
    }
    async getFlagStats(claims, filters) {
        return this.uow.asCaller(claims, async () => {
            return this.repo.getFlagStats(filters);
        });
    }
    async getCountActive(claims) {
        return this.uow.asCaller(claims, async () => {
            return this.repo.getCountActive();
        });
    }
    async getByProfile(claims, profileId) {
        return this.uow.asCaller(claims, async () => {
            const id = await this.repo.getMemberIdByProfileId(profileId);
            return { id };
        });
    }
    async updateMember(claims, id, b) {
        return this.uow.asCaller(claims, async () => {
            const profileSet = {
                full_name: b.full_name,
                national_id: b.national_id,
                phone: b.phone || null,
                email: b.email || null,
            };
            if (b.avatar_url !== undefined)
                profileSet.avatar_url = b.avatar_url;
            await this.repo.updateColumns('profiles', b.profile_id, profileSet);
            const memberSet = {};
            for (const k of MEMBER_COLUMNS)
                if (b[k] !== undefined)
                    memberSet[k] = b[k];
            if (Object.keys(memberSet).length)
                await this.repo.updateColumns('members', id, memberSet);
            return { ok: true };
        });
    }
    async deleteByProfile(caller, claims, profileId) {
        return this.uow.asCaller(claims, async () => {
            const memberId = await this.repo.getMemberIdByProfileId(profileId);
            if (memberId) {
                const { requireMember } = await import('../../common/auth/access.service.js');
                await requireMember(this.repo.db, caller, memberId);
            }
            await this.repo.deleteProfile(profileId);
        });
    }
    async bulkUpdate(claims, filters, patch) {
        return this.uow.asCaller(claims, async () => {
            return this.repo.bulkUpdateMembers(filters, patch);
        });
    }
    async bulkDelete(claims, filters) {
        return this.uow.asCaller(claims, async () => {
            return this.repo.bulkDeleteProfiles(filters);
        });
    }
};
MembersService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        MembersRepository])
], MembersService);
export { MembersService };
//# sourceMappingURL=members.service.js.map