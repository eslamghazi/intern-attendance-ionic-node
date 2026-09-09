import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { AuthRepository, Account, StoredToken } from './auth.repository.js';
import { classifyRefresh, expiresInSeconds, expiryFrom } from '../../domain/auth/refresh.js';
import { initialPassword, resolveLogin } from '../../domain/identity/credentials.js';
import {
  mayDeleteStaff,
  mayResetPasswordOf,
  mayChangePasswordWithoutCurrent,
  type Caller,
  type Role,
} from '../../domain/identity/role.js';
import { parseNationalId } from '../../domain/identity/nationalId.js';
import { signProfileJwt } from '../../auth/jwt.js';
import { env } from '../../env.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../../http/errors.js';

const BCRYPT_COST = 10;

export interface LoginResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
  role: Role;
  must_change_password: boolean;
  profile: { id: string; full_name: string };
}

class MasterPasswordRefused extends Error {
  constructor(readonly profileId: string, readonly role: Role) {
    super('forbidden');
  }
}

interface RefreshRefusal {
  revokeFamilyId: string | null;
  auditProfileId: string | null;
}

export interface NewStaff {
  national_id: string;
  full_name: string;
  phone?: string | null;
  password?: string;
  role: 'admin';
  assignments: { group_id?: string | null; branch_id?: string | null }[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: AuthRepository,
  ) {}

  private mintRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issuePair(
    account: { id: string; nationalId: string; role: Role },
    familyId: string,
    userAgent: string | null,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
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

  private async passwordOpens(account: Account, password: string): Promise<boolean> {
    const initial = initialPassword(account);
    if (initial !== null) return password === initial;
    if (!account.passwordHash) return false;
    return bcrypt.compare(password, account.passwordHash);
  }

  private async hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_COST);
  }

  private defaultPassword(account: Account, override?: string): string {
    const password = override || parseNationalId(account.nationalId).dobPassword;
    if (!password) throw badRequest('cannot_derive_password', 'cannot derive a password');
    return password;
  }

  // --- Core Methods ---

  async login(
    nationalId: string,
    password: string,
    userAgent: string | null = null,
  ): Promise<LoginResult> {
    try {
      return await this.loginInTransaction(nationalId, password, userAgent);
    } catch (err) {
      if (err instanceof MasterPasswordRefused) {
        await this.uow.asService(() =>
          this.repo.audit(err.profileId, 'master_login', { role: err.role, refused: true }),
        );
        throw forbidden('forbidden');
      }
      throw err;
    }
  }

  private async loginInTransaction(
    nationalId: string,
    password: string,
    userAgent: string | null,
  ): Promise<LoginResult> {
    return this.uow.asService(async () => {
      const account = await this.repo.findAccountByNationalId(nationalId);
      if (!account || !account.isActive) throw notFound('not_found');

      const ownOk = await this.passwordOpens(account, password);
      const masterOk = ownOk ? false : await this.verifyMaster(password);

      const verdict = resolveLogin(account.role, ownOk, masterOk);
      if (verdict === 'refused') throw unauthorized('invalid_credentials');
      if (verdict === 'forbidden') {
        throw new MasterPasswordRefused(account.id, account.role);
      }
      if (verdict === 'master') {
        await this.repo.audit(account.id, 'master_login', { role: account.role });
      }

      const pair = await this.issuePair(account, randomUUID(), userAgent);
      return {
        access_token: pair.accessToken,
        refresh_token: pair.refreshToken,
        expires_in: pair.expiresIn,
        token_type: 'Bearer',
        role: account.role,
        must_change_password: account.mustChangePassword,
        profile: { id: account.id, full_name: account.fullName },
      };
    });
  }

  async getMe(caller: Caller) {
    return this.uow.asCaller(null, async () => {
      const profile = await this.repo.getProfile(caller.id);
      if (!profile) return { profile: null, member: null, is_enrolled: false };

      if (caller.role !== 'member') {
        return { profile, member: null, is_enrolled: false };
      }

      const member = await this.repo.getMemberProfile(caller.id);
      return { profile, member: member ?? null, is_enrolled: Boolean(member?.is_enrolled) };
    });
  }

  async refresh(presented: string, userAgent: string | null): Promise<LoginResult> {
    const outcome = await this.uow.asService<{ ok: true; value: LoginResult } | { ok: false; refusal: RefreshRefusal }>(
      async () => {
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
            must_change_password: account.mustChangePassword,
            profile: { id: account.id, full_name: account.fullName },
          },
        };
      },
    );

    if (outcome.ok) return outcome.value;

    const { revokeFamilyId, auditProfileId } = outcome.refusal;
    if (revokeFamilyId) {
      await this.uow.asService(async () => {
        await this.repo.revokeFamily(revokeFamilyId);
        if (auditProfileId) {
          await this.repo.audit(auditProfileId, 'login', {
            event: 'refresh_token_reuse',
            family: revokeFamilyId,
          });
        }
      });
    }
    throw unauthorized('invalid_refresh_token');
  }

  async logout(presented: string | null): Promise<void> {
    if (!presented) return;
    return this.uow.asService(async () => {
      const stored = await this.repo.findTokenByHash(this.hashRefreshToken(presented));
      if (stored) await this.repo.revokeFamily(stored.familyId);
    });
  }

  async logoutEverywhere(caller: Caller): Promise<{ revoked: number }> {
    return this.uow.asService(async () => ({
      revoked: await this.repo.revokeAllForProfile(caller.id),
    }));
  }

  async changeOwnPassword(
    caller: Caller,
    current: string,
    next: string,
    userAgent: string | null = null,
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    return this.uow.asService(async () => {
      const account = await this.repo.findAccountById(caller.id);
      if (!account) throw notFound();
      if (!(await this.passwordOpens(account, current))) throw unauthorized('wrong_current');
      
      await this.repo.storePasswordHash(account.id, await this.hash(next), false);
      await this.repo.revokeAllForProfile(account.id);
      
      const pair = await this.issuePair(account, randomUUID(), userAgent);
      return {
        access_token: pair.accessToken,
        refresh_token: pair.refreshToken,
        expires_in: pair.expiresIn,
      };
    });
  }

  async setInitialPassword(
    caller: Caller,
    next: string,
    userAgent: string | null = null,
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    return this.uow.asService(async () => {
      const account = await this.repo.findAccountById(caller.id);
      if (!account) throw notFound();
      if (!mayChangePasswordWithoutCurrent(account.mustChangePassword)) {
        throw forbidden('use /auth/password: this account already has a password');
      }
      
      await this.repo.storePasswordHash(account.id, await this.hash(next), false);
      await this.repo.revokeAllForProfile(account.id);
      
      const pair = await this.issuePair(account, randomUUID(), userAgent);
      return {
        access_token: pair.accessToken,
        refresh_token: pair.refreshToken,
        expires_in: pair.expiresIn,
      };
    });
  }

  async resetPassword(
    actor: Caller,
    target: { profileId?: string; nationalId?: string; expect?: 'member' | 'staff'; password?: string },
  ): Promise<{ password: string }> {
    return this.uow.asService(async () => {
      const account = target.profileId
        ? await this.repo.findAccountById(target.profileId)
        : await this.repo.findAccountByNationalId(target.nationalId!);
      if (!account) throw notFound();

      if (target.expect === 'member' && account.role !== 'member') {
        throw badRequest('not_a_member', 'not a member');
      }
      if (target.expect === 'staff' && account.role === 'member') {
        throw badRequest('not_staff', 'not a staff account');
      }
      if (!mayResetPasswordOf(actor.role, account.role)) throw forbidden();

      const password = this.defaultPassword(account, target.password);
      await this.repo.storePasswordHash(account.id, await this.hash(password), true);
      await this.repo.revokeAllForProfile(account.id);
      await this.repo.audit(actor.id, 'password_changed', {
        reset_for: account.id,
        by: actor.id,
      });
      return { password };
    });
  }

  async createStaff(
    actor: Caller,
    input: NewStaff,
  ): Promise<{ id: string; password: string }> {
    const parsed = parseNationalId(input.national_id);
    if (!parsed.valid) throw badRequest('invalid_national_id', 'invalid national id');
    const password = input.password || parsed.dobPassword!;
    const passwordHash = await this.hash(password);

    const id = await this.uow.asService(async () => {
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

  async deleteStaff(actor: Caller, id: string): Promise<void> {
    return this.uow.asService(async () => {
      const account = await this.repo.findAccountById(id);
      if (!account) throw notFound();
      if (actor.id === id) throw badRequest('cannot_delete_self', 'cannot delete yourself');
      if (!mayDeleteStaff(actor, id, account.role)) {
        throw forbidden('only admin accounts can be deleted');
      }

      await this.repo.deleteProfile(id);
      await this.repo.audit(actor.id, 'staff_deleted', { profile_id: id });
    });
  }

  private async verifyMaster(password: string): Promise<boolean> {
    const stored = await this.repo.readMasterPasswordHash();
    if (!stored || !password) return false;
    return bcrypt.compare(password, stored);
  }

  async masterPasswordIsSet(): Promise<boolean> {
    return this.uow.asService(async () => (await this.repo.readMasterPasswordHash()) !== null);
  }

  async setMasterPassword(password: string): Promise<void> {
    const stored = password === '' ? null : await this.hash(password);
    return this.uow.asService(() => this.repo.writeMasterPasswordHash(stored));
  }
}
