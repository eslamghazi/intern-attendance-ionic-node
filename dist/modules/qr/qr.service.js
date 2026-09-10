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
import { QrRepository } from './qr.repository.js';
import { requireBranch } from '../../common/auth/access.service.js';
import { cairoNow } from '../../domain/clock.js';
import { bypassMinutes, checkinBlocked, mintToken, planMint, qrAllowed, validitySeconds, } from '../../domain/qr/token.js';
import { badRequest, forbidden, ApiError } from '../../http/errors.js';
import { Role } from '../../common/enums/index.js';
function rules(s) {
    return {
        checkinMethod: s.checkin_method || 'both',
        qrRequiresMember: Boolean(s.qr_requires_member),
        qrValiditySeconds: s.qr_validity_seconds,
        qrBypassMinutes: s.qr_bypass_minutes,
    };
}
let QrService = class QrService {
    uow;
    repo;
    constructor(uow, repo) {
        this.uow = uow;
        this.repo = repo;
    }
    async mintQr(caller, parsed) {
        return this.uow.asService(async () => {
            let branchId = parsed.branch_id ?? '';
            let memberIsGenerator = false;
            if (caller.role === Role.MEMBER) {
                const member = await this.repo.getMemberByProfileId(caller.id);
                if (!member?.can_generate_qr)
                    throw forbidden();
                branchId = member.branch_id ?? '';
                memberIsGenerator = true;
            }
            if (!branchId)
                throw badRequest('missing', 'branch_id is required');
            if (!memberIsGenerator) {
                await requireBranch(this.repo.db, caller, branchId);
            }
            const settingsRaw = await this.repo.getSettings();
            const settings = rules(settingsRaw);
            const branchQrEnabled = await this.repo.getBranchQrEnabled(branchId);
            if (!qrAllowed(settings.checkinMethod, branchQrEnabled)) {
                throw new ApiError(403, 'qr_disabled', 'QR check-in is not enabled here');
            }
            const planned = planMint({ byMember: memberIsGenerator, branchId, memberId: parsed.member_id ?? null }, settings);
            if (!planned.ok) {
                throw planned.reason === 'member_required'
                    ? badRequest('member_required', 'this deployment requires a member-specific QR')
                    : badRequest('missing', 'branch_id is required');
            }
            const plan = planned.plan;
            await this.repo.deleteExpiredTokens();
            const validity = validitySeconds(settings);
            const token = mintToken();
            const expiresAt = new Date(Date.now() + validity * 1000);
            await this.repo.insertToken({
                token,
                branchId: plan.branchId,
                date: parsed.date,
                memberId: plan.memberId,
                singleUse: plan.singleUse,
                expiresAt: expiresAt.toISOString(),
                createdBy: caller.id,
            });
            return { ok: true, token, date: parsed.date, validity_seconds: validity };
        });
    }
    async redeemQr(caller, tokenCode) {
        return this.uow.asService(async () => {
            const member = await this.repo.getMemberWithBranch(caller.id);
            if (!member || !member.branch_id)
                throw forbidden('not_a_member');
            const settingsRaw = await this.repo.getSettings();
            const settings = rules(settingsRaw);
            if (checkinBlocked(settings.checkinMethod, member.block_checkin)) {
                throw new ApiError(403, 'branch_blocked', 'check-in is blocked for this branch');
            }
            if (!qrAllowed(settings.checkinMethod, member.qr_enabled)) {
                throw new ApiError(422, 'qr_disabled', 'QR check-in is not enabled here');
            }
            const token = await this.repo.getValidToken(tokenCode, member.branch_id, cairoNow().date, member.id, settings.qrRequiresMember);
            if (!token)
                throw new ApiError(422, 'qr_invalid', 'this QR is not valid');
            if (token.single_use) {
                await this.repo.markTokenUsed(token.id);
            }
            const minutes = bypassMinutes(settings);
            const bypassUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
            const updated = await this.repo.updateMemberBypass(member.id, bypassUntil);
            return { ok: true, until: updated?.locationBypassUntil, minutes };
        });
    }
};
QrService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        QrRepository])
], QrService);
export { QrService };
//# sourceMappingURL=qr.service.js.map