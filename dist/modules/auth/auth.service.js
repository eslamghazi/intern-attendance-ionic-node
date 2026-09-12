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
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { AuthRepository } from './auth.repository.js';
import { classifyRefresh, expiresInSeconds, expiryFrom } from '../../domain/auth/refresh.js';
import { initialPassword, resolveLogin } from '../../domain/identity/credentials.js';
import { isHiddenAccount, mayCreateStaffAs, mayDeleteStaff, mayResetPasswordOf, } from '../../domain/identity/role.js';
import { Role, AuditEvent } from '../../common/enums/index.js';
import { parseNationalId } from '../../domain/identity/nationalId.js';
import { signProfileJwt } from '../../common/auth/jwt.js';
import { env } from '../../config/env.js';
import { ApiError, badRequest, conflict, forbidden, notFound, unauthorized, } from '../../common/errors.js';
import { BCRYPT_COST } from '../../config/constants.js';
class MasterPasswordRefused extends Error {
    profileId;
    role;
    constructor(profileId, role) {
        super('forbidden');
        this.profileId = profileId;
        this.role = role;
    }
}
import { AuthMapper } from './auth.mapper.js';
let AuthService = class AuthService {
    uow;
    repo;
    constructor(uow, repo) {
        this.uow = uow;
        this.repo = repo;
    }
    mintRefreshToken() {
        return randomBytes(32).toString('base64url');
    }
    hashRefreshToken(token) {
        return createHash('sha256').update(token).digest('hex');
    }
    async issuePair(account, familyId, userAgent) {
        const refreshToken = this.mintRefreshToken();
        await this.repo.insertToken({
            profileId: account.id,
            familyId,
            tokenHash: this.hashRefreshToken(refreshToken),
            expiresAt: expiryFrom(new Date(), env.REFRESH_TOKEN_TTL_DAYS),
            userAgent: userAgent ? userAgent.slice(0, 200) : null,
        });
        return {
            accessToken: signProfileJwt(account.id, account.nationalId, account.role),
            refreshToken,
            expiresIn: expiresInSeconds(env.ACCESS_TOKEN_TTL_MINUTES),
        };
    }
    async passwordOpens(account, password) {
        const initial = initialPassword(account);
        if (initial !== null)
            return password === initial;
        if (!account.passwordHash)
            return false;
        return bcrypt.compare(password, account.passwordHash);
    }
    async hash(password) {
        return bcrypt.hash(password, BCRYPT_COST);
    }
    defaultPassword(account, override) {
        const password = override || parseNationalId(account.nationalId).dobPassword;
        if (!password)
            throw badRequest('cannot_derive_password', 'cannot derive a password');
        return password;
    }
    // --- Core Methods ---
    async login(nationalId, password, userAgent = null) {
        try {
            return await this.loginInTransaction(nationalId, password, userAgent);
        }
        catch (err) {
            if (err instanceof MasterPasswordRefused) {
                await this.uow.transaction(() => this.repo.audit(err.profileId, AuditEvent.MASTER_LOGIN, { role: err.role, refused: true }));
                throw forbidden('forbidden');
            }
            throw err;
        }
    }
    async loginInTransaction(nationalId, password, userAgent) {
        return this.uow.transaction(async () => {
            const account = await this.repo.findAccountByNationalId(nationalId);
            // Two refusals, told apart on purpose.
            //
            // A national id with NO account says so ("not registered"). It used to
            // answer the generic 404 "requested resource not found", which told a
            // member who had mistyped one digit of a fourteen-digit number nothing at
            // all — they retyped the same wrong number and blamed the password.
            //
            // Everything else — wrong password, disabled account, a refused master
            // password — answers with the SAME `invalid_credentials`, so for a
            // national id that does exist nothing outside can tell which half was
            // wrong, or that the account was switched off.
            //
            // This does mean the endpoint confirms which national ids have accounts.
            // That is the deliberate trade: the ids are already known to whoever is
            // enrolling members, and the login screen is rate limited.
            if (!account) {
                throw new ApiError(404, 'not_registered', 'this national id is not registered');
            }
            if (!account.isActive) {
                throw new ApiError(401, 'invalid_credentials', 'wrong national id or password');
            }
            const ownOk = await this.passwordOpens(account, password);
            const masterOk = ownOk ? false : await this.verifyMaster(password);
            const verdict = resolveLogin(account.role, ownOk, masterOk);
            if (verdict === 'refused') {
                throw new ApiError(401, 'invalid_credentials', 'wrong national id or password');
            }
            if (verdict === 'forbidden') {
                throw new MasterPasswordRefused(account.id, account.role);
            }
            if (verdict === 'master') {
                await this.repo.audit(account.id, AuditEvent.MASTER_LOGIN, { role: account.role });
            }
            const pair = await this.issuePair(account, randomUUID(), userAgent);
            return {
                access_token: pair.accessToken,
                refresh_token: pair.refreshToken,
                expires_in: pair.expiresIn,
                token_type: 'Bearer',
                role: account.role,
                profile: { id: account.id, full_name: account.fullName },
            };
        });
    }
    async getMe(caller) {
        return this.uow.transaction(async () => {
            const profile = await this.repo.getProfile(caller.id);
            if (!profile)
                return { profile: null, member: null, is_enrolled: false };
            // Staff belong to no branch or group, so there is no placement to read.
            if (caller.role !== Role.MEMBER)
                return AuthMapper.toMeResponse(profile, null);
            const member = await this.repo.getMemberProfile(caller.id);
            return AuthMapper.toMeResponse(profile, member ?? null);
        });
    }
    async refresh(presented, userAgent) {
        const outcome = await this.uow.transaction(async () => {
            const stored = await this.repo.findTokenByHash(this.hashRefreshToken(presented));
            const verdict = classifyRefresh(stored, new Date());
            if (verdict.kind === 'reuse') {
                return {
                    ok: false,
                    refusal: {
                        revokeFamilyId: verdict.familyId,
                        auditProfileId: stored ? stored.profileId : null,
                    },
                };
            }
            if (verdict.kind === 'reject' || !stored) {
                return { ok: false, refusal: { revokeFamilyId: null, auditProfileId: null } };
            }
            if (!(await this.repo.markTokenRotated(stored.id))) {
                return {
                    ok: false,
                    refusal: { revokeFamilyId: stored.familyId, auditProfileId: null },
                };
            }
            const account = await this.repo.findAccountById(stored.profileId);
            if (!account || !account.isActive) {
                return {
                    ok: false,
                    refusal: { revokeFamilyId: stored.familyId, auditProfileId: null },
                };
            }
            const pair = await this.issuePair(account, stored.familyId, userAgent);
            return {
                ok: true,
                value: {
                    access_token: pair.accessToken,
                    refresh_token: pair.refreshToken,
                    expires_in: pair.expiresIn,
                    token_type: 'Bearer',
                    role: account.role,
                    profile: { id: account.id, full_name: account.fullName },
                },
            };
        });
        if (outcome.ok)
            return outcome.value;
        const { revokeFamilyId, auditProfileId } = outcome.refusal;
        if (revokeFamilyId) {
            await this.uow.transaction(async () => {
                await this.repo.revokeFamily(revokeFamilyId);
                if (auditProfileId) {
                    await this.repo.audit(auditProfileId, AuditEvent.LOGIN, {
                        event: 'refresh_token_reuse',
                        family: revokeFamilyId,
                    });
                }
            });
        }
        throw unauthorized('invalid_refresh_token');
    }
    async logout(presented) {
        if (!presented)
            return;
        return this.uow.transaction(async () => {
            const stored = await this.repo.findTokenByHash(this.hashRefreshToken(presented));
            if (stored)
                await this.repo.revokeFamily(stored.familyId);
        });
    }
    async logoutEverywhere(caller) {
        return this.uow.transaction(async () => ({
            revoked: await this.repo.revokeAllForProfile(caller.id),
        }));
    }
    async changeOwnPassword(caller, current, next, userAgent = null) {
        return this.uow.transaction(async () => {
            const account = await this.repo.findAccountById(caller.id);
            if (!account)
                throw notFound();
            if (!(await this.passwordOpens(account, current)))
                throw unauthorized('wrong_current');
            await this.repo.storePasswordHash(account.id, await this.hash(next));
            await this.repo.revokeAllForProfile(account.id);
            const pair = await this.issuePair(account, randomUUID(), userAgent);
            return {
                access_token: pair.accessToken,
                refresh_token: pair.refreshToken,
                expires_in: pair.expiresIn,
            };
        });
    }
    async resetPassword(actor, target) {
        return this.uow.transaction(async () => {
            const account = target.profileId
                ? await this.repo.findAccountById(target.profileId)
                : await this.repo.findAccountByNationalId(target.nationalId);
            // The seeded superadmin is not a target for anyone; it does not exist
            // as far as this route is concerned.
            if (!account || (isHiddenAccount(account.nationalId) && actor.id !== account.id))
                throw notFound();
            if (target.expect === 'member' && account.role !== Role.MEMBER) {
                throw badRequest('not_a_member', 'not a member');
            }
            if (target.expect === 'staff' && account.role === Role.MEMBER) {
                throw badRequest('not_staff', 'not a staff account');
            }
            if (!mayResetPasswordOf(actor.role, account.role))
                throw forbidden();
            const password = this.defaultPassword(account, target.password);
            await this.repo.storePasswordHash(account.id, await this.hash(password));
            await this.repo.revokeAllForProfile(account.id);
            await this.repo.audit(actor.id, AuditEvent.PASSWORD_CHANGED, {
                reset_for: account.id,
                by: actor.id,
            });
            return { password };
        });
    }
    async createStaff(actor, input) {
        // An admin holding the admins page creates admins. A superadmin is only
        // ever created by a superadmin — whatever page the actor holds.
        if (!mayCreateStaffAs(actor, input.role)) {
            throw forbidden('only a superadmin may create a superadmin');
        }
        const parsed = parseNationalId(input.national_id);
        if (!parsed.valid)
            throw badRequest('invalid_national_id', 'invalid national id');
        const password = input.password || parsed.dobPassword;
        const passwordHash = await this.hash(password);
        const id = await this.uow.transaction(async () => {
            if (await this.repo.findAccountByNationalId(input.national_id)) {
                throw conflict('duplicate', 'national id already in use');
            }
            const profileId = randomUUID();
            await this.repo.createStaff(actor.id, profileId, input, passwordHash);
            for (const a of input.assignments.filter((x) => x.group_id || x.branch_id)) {
                await this.repo.createAdminAssignment(profileId, a.group_id ?? null, a.branch_id ?? null);
            }
            return profileId;
        });
        return { id, password };
    }
    async deleteStaff(actor, id) {
        return this.uow.transaction(async () => {
            const account = await this.repo.findAccountById(id);
            if (!account)
                throw notFound();
            if (actor.id === id)
                throw badRequest('cannot_delete_self', 'cannot delete yourself');
            if (!mayDeleteStaff(actor, id, account.role)) {
                throw forbidden('only admin accounts can be deleted');
            }
            await this.repo.deleteProfile(id);
            await this.repo.audit(actor.id, AuditEvent.STAFF_DELETED, { profile_id: id });
        });
    }
    async verifyMaster(password) {
        const stored = await this.repo.readMasterPasswordHash();
        if (!stored || !password)
            return false;
        return bcrypt.compare(password, stored);
    }
    async masterPasswordIsSet() {
        return this.uow.transaction(async () => (await this.repo.readMasterPasswordHash()) !== null);
    }
    async setMasterPassword(password) {
        const stored = password === '' ? null : await this.hash(password);
        return this.uow.transaction(() => this.repo.writeMasterPasswordHash(stored));
    }
};
AuthService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        AuthRepository])
], AuthService);
export { AuthService };
//# sourceMappingURL=auth.service.js.map