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
import { GenericRepository } from '../../common/database/generic.repository.js';
import { members, profiles, memberDirectory } from '../../db/schema/index.js';
import { eq, sql, inArray, count, and } from 'drizzle-orm';
import { parseNationalId } from '../../domain/identity/nationalId.js';
import { directoryWhere, filteredMemberIds, filteredProfileIds } from '../../domain/member/filter.js';
import { notFound } from '../../http/errors.js';
import { Role } from '../../common/enums/index.js';
let MembersRepository = class MembersRepository extends GenericRepository {
    constructor() {
        super(members, members.id);
    }
    async getFrozenAt(profileId) {
        const rows = await this.db
            .select({ frozen_at: members.frozenAt })
            .from(members)
            .where(eq(members.profileId, profileId))
            .limit(1);
        const value = rows[0]?.frozen_at;
        return value ? new Date(value) : null;
    }
    async updateColumns(table, id, patch) {
        const tableSchema = table === 'profiles' ? profiles : members;
        const rows = await this.db
            .update(tableSchema)
            .set(patch)
            .where(eq(tableSchema.id, id))
            .returning({ id: tableSchema.id });
        if (!rows.length)
            throw notFound();
    }
    async upsertMember(callerId, input) {
        const nid = input.national_id;
        if (!parseNationalId(nid).valid) {
            return { national_id: nid, ok: false, error: 'invalid_national_id' };
        }
        if (!input.full_name)
            return { national_id: nid, ok: false, error: 'missing_name' };
        const existingRows = await this.db
            .select({ id: profiles.id, role: profiles.role })
            .from(profiles)
            .where(eq(profiles.nationalId, nid))
            .limit(1);
        const existing = existingRows[0];
        if (existing) {
            if (existing.role !== Role.MEMBER) {
                return { national_id: nid, ok: false, error: 'national_id_belongs_to_staff' };
            }
            await this.db
                .update(profiles)
                .set({
                fullName: input.full_name,
                phone: input.phone ?? null,
                email: input.email ?? null,
            })
                .where(eq(profiles.id, existing.id));
            await this.db
                .update(members)
                .set({
                groupId: input.group_id,
                branchId: input.branch_id,
            })
                .where(eq(members.profileId, existing.id));
            return { national_id: nid, ok: true, updated: true };
        }
        const createdRows = await this.db
            .insert(profiles)
            .values({
            role: Role.MEMBER,
            fullName: input.full_name,
            nationalId: nid,
            phone: input.phone ?? null,
            email: input.email ?? null,
            mustChangePassword: false,
            createdBy: callerId,
        })
            .returning({ id: profiles.id });
        const createdProfile = createdRows[0];
        await this.db
            .insert(members)
            .values({
            profileId: createdProfile.id,
            groupId: input.group_id,
            branchId: input.branch_id,
        });
        return { national_id: nid, ok: true };
    }
    async getNationalIds() {
        const rows = await this.db
            .select({ national_id: profiles.nationalId })
            .from(profiles)
            .where(and(eq(profiles.role, Role.MEMBER), sql `national_id is not null`))
            .orderBy(profiles.id);
        return rows.map((r) => r.national_id);
    }
    async getMembersDirectory(filters, limit, offset) {
        const rows = await this.db
            .select({
            member_id: memberDirectory.memberId,
            profile_id: memberDirectory.profileId,
            group_id: memberDirectory.groupId,
            branch_id: memberDirectory.branchId,
            is_active: memberDirectory.isActive,
            bypass_face: memberDirectory.bypassFace,
            bypass_location: memberDirectory.bypassLocation,
            bypass_checkout_window: memberDirectory.bypassCheckoutWindow,
            frozen_at: memberDirectory.frozenAt,
            can_generate_qr: memberDirectory.canGenerateQr,
            can_make_roster: memberDirectory.canMakeRoster,
            can_reset_face: memberDirectory.canResetFace,
            has_face: memberDirectory.hasFace,
            member_code: memberDirectory.memberCode,
            full_name: memberDirectory.fullName,
            national_id: memberDirectory.nationalId,
            phone: memberDirectory.phone,
            email: memberDirectory.email,
            avatar_url: memberDirectory.avatarUrl,
            group_name: memberDirectory.groupName,
            branch_name: memberDirectory.branchName,
            total: sql `count(*) over ()`,
        })
            .from(memberDirectory)
            .where(directoryWhere(filters))
            .orderBy(memberDirectory.fullName, memberDirectory.memberId)
            .limit(limit)
            .offset(offset);
        return rows;
    }
    async getMembersPage(filters, limit, offset) {
        const rows = await this.db
            .select({
            member_id: memberDirectory.memberId,
            full_name: memberDirectory.fullName,
            national_id: memberDirectory.nationalId,
            member_code: memberDirectory.memberCode,
            total: sql `count(*) over ()`,
        })
            .from(memberDirectory)
            .where(directoryWhere(filters))
            .orderBy(memberDirectory.fullName, memberDirectory.memberId)
            .limit(limit)
            .offset(offset);
        return rows;
    }
    async getFlagStats(filters) {
        const rows = await this.db
            .select({
            total: count(),
            bypass_face: sql `count(*) filter (where ${memberDirectory.bypassFace})`.mapWith(Number),
            bypass_location: sql `count(*) filter (where ${memberDirectory.bypassLocation})`.mapWith(Number),
            frozen: sql `count(*) filter (where ${memberDirectory.frozenAt} is not null)`.mapWith(Number),
        })
            .from(memberDirectory)
            .where(directoryWhere(filters));
        const r = rows[0];
        return {
            total: Number(r.total),
            bypass_face: r.bypass_face,
            bypass_location: r.bypass_location,
            frozen: r.frozen,
        };
    }
    async getCountActive() {
        const rows = await this.db
            .select({ count: count() })
            .from(members)
            .where(eq(members.isActive, true));
        return { count: rows[0].count };
    }
    async getMemberIdByProfileId(profileId) {
        const rows = await this.db
            .select({ id: members.id })
            .from(members)
            .where(eq(members.profileId, profileId))
            .limit(1);
        return rows[0]?.id ?? null;
    }
    async deleteProfile(profileId) {
        const rows = await this.db
            .delete(profiles)
            .where(eq(profiles.id, profileId))
            .returning({ id: profiles.id });
        if (!rows[0])
            throw notFound();
    }
    async bulkUpdateMembers(filters, patch) {
        if (!Object.keys(patch).length)
            return { affected: 0 };
        // Convert filtered ids to a subquery using sql expression
        const idsToUpdate = filteredMemberIds(filters);
        const rows = await this.db
            .update(members)
            .set(patch)
            .where(inArray(members.id, idsToUpdate))
            .returning({ id: members.id });
        return { affected: rows.length };
    }
    async bulkDeleteProfiles(filters) {
        const idsToDelete = filteredProfileIds(filters);
        const rows = await this.db
            .delete(profiles)
            .where(inArray(profiles.id, idsToDelete))
            .returning({ id: profiles.id });
        return { affected: rows.length };
    }
};
MembersRepository = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], MembersRepository);
export { MembersRepository };
//# sourceMappingURL=members.repository.js.map