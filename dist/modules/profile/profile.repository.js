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
import { eq, and, ne } from 'drizzle-orm';
import { members, profiles } from '../../db/schema/index.js';
let ProfileRepository = class ProfileRepository extends GenericRepository {
    constructor() {
        super(profiles, profiles.id);
    }
    async markEnrolled(profileId) {
        await this.db
            .update(members)
            .set({ enrollmentStatus: 'enrolled' })
            .where(eq(members.profileId, profileId));
    }
    async markPasswordChanged(profileId) {
        await this.db
            .update(profiles)
            .set({ mustChangePassword: false })
            .where(eq(profiles.id, profileId));
    }
    async isNationalIdTaken(nationalId, excludeProfileId) {
        const rows = await this.db
            .select({ id: profiles.id })
            .from(profiles)
            .where(and(eq(profiles.nationalId, nationalId), ne(profiles.id, excludeProfileId)))
            .limit(1);
        return rows.length > 0;
    }
    async updateOwnProfile(profileId, edit) {
        const updateData = {};
        if (edit.fullName !== '')
            updateData.fullName = edit.fullName;
        updateData.phone = edit.phone === '' ? null : edit.phone;
        updateData.email = edit.email === '' ? null : edit.email;
        if (edit.nationalId !== '')
            updateData.nationalId = edit.nationalId;
        if (edit.avatarUrl !== null)
            updateData.avatarUrl = edit.avatarUrl;
        await this.db
            .update(profiles)
            .set(updateData)
            .where(eq(profiles.id, profileId));
    }
    async getMemberCode(profileId) {
        const rows = await this.db
            .select({ memberCode: members.memberCode })
            .from(members)
            .where(eq(members.profileId, profileId))
            .limit(1);
        return rows[0]?.memberCode ?? null;
    }
};
ProfileRepository = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], ProfileRepository);
export { ProfileRepository };
//# sourceMappingURL=profile.repository.js.map