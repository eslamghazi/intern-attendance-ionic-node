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
import { appSettings, members, branches, qrTokens } from '../../db/schema/index.js';
import { eq, lt, gt, and, isNull, or } from 'drizzle-orm';
let QrRepository = class QrRepository extends GenericRepository {
    constructor() {
        super(qrTokens, qrTokens.id);
    }
    async getSettings() {
        const rows = await this.db
            .select({
            qr_requires_member: appSettings.qrRequiresMember,
            qr_validity_seconds: appSettings.qrValiditySeconds,
            qr_bypass_minutes: appSettings.qrBypassMinutes,
            checkin_method: appSettings.checkinMethod,
        })
            .from(appSettings)
            .where(eq(appSettings.id, 1));
        return rows[0] ?? {
            qr_requires_member: null,
            qr_validity_seconds: null,
            qr_bypass_minutes: null,
            checkin_method: null,
        };
    }
    async getMemberByProfileId(profileId) {
        const rows = await this.db
            .select({
            branch_id: members.branchId,
            can_generate_qr: members.canGenerateQr,
        })
            .from(members)
            .where(eq(members.profileId, profileId))
            .limit(1);
        return rows[0] ?? null;
    }
    async getBranchQrEnabled(branchId) {
        const rows = await this.db
            .select({ qr_enabled: branches.qrEnabled })
            .from(branches)
            .where(eq(branches.id, branchId))
            .limit(1);
        return rows[0]?.qr_enabled ?? null;
    }
    async deleteExpiredTokens() {
        await this.db.delete(qrTokens).where(lt(qrTokens.expiresAt, new Date().toISOString()));
    }
    async insertToken(data) {
        await this.db.insert(qrTokens).values(data);
    }
    async getMemberWithBranch(profileId) {
        const rows = await this.db
            .select({
            id: members.id,
            branch_id: members.branchId,
            qr_enabled: branches.qrEnabled,
            block_checkin: branches.blockCheckin,
        })
            .from(members)
            .leftJoin(branches, eq(branches.id, members.branchId))
            .where(eq(members.profileId, profileId))
            .limit(1);
        return rows[0] ?? null;
    }
    async getValidToken(token, branchId, date, memberId, qrRequiresMember) {
        const rows = await this.db
            .select({ id: qrTokens.id, single_use: qrTokens.singleUse })
            .from(qrTokens)
            .where(and(eq(qrTokens.token, token), eq(qrTokens.branchId, branchId), eq(qrTokens.date, date), gt(qrTokens.expiresAt, new Date().toISOString()), or(eq(qrTokens.singleUse, false), isNull(qrTokens.usedAt)), or(isNull(qrTokens.memberId), eq(qrTokens.memberId, memberId)), qrRequiresMember === false ? undefined : isNotNull(qrTokens.memberId)))
            .limit(1);
        return rows[0] ?? null;
    }
    async markTokenUsed(id) {
        await this.db
            .update(qrTokens)
            .set({ usedAt: new Date().toISOString() })
            .where(eq(qrTokens.id, id));
    }
    async updateMemberBypass(memberId, bypassUntil) {
        const rows = await this.db
            .update(members)
            .set({ locationBypassUntil: bypassUntil })
            .where(eq(members.id, memberId))
            .returning({ locationBypassUntil: members.locationBypassUntil });
        return rows[0] ?? null;
    }
};
QrRepository = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], QrRepository);
export { QrRepository };
// Need to define a small helper for isNotNull to be exported properly or just use not(isNull())
import { isNotNull } from 'drizzle-orm';
//# sourceMappingURL=qr.repository.js.map