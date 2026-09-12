import { Injectable } from '@nestjs/common';
import { AuditRepository } from '../audit/audit.repository.js';
import { GenericRepository } from '../../infrastructure/database/generic.repository.js';
import { eq, exists, isNull, and } from 'drizzle-orm';
import { QueryBuilder } from 'drizzle-orm/pg-core';
import { profiles, appSettings, refreshTokens, auditLog, adminAssignments, members, branches, groups, institutions, faceTemplates } from '../../infrastructure/database/schema/index.js';
import { Role } from '../../domain/identity/role.js';
import type { StoredRefreshToken } from '../../domain/auth/refresh.js';
import type { AdminPermissions } from '../../domain/identity/types.js';
import type { IAuthRepository } from './interfaces/auth.interface.js';
import type { Account, StoredToken } from './auth.types.js';
import type { JsonValue } from '../../common/json.types.js';
export type { Account, StoredToken } from './auth.types.js';

@Injectable()
export class AuthRepository extends GenericRepository<typeof profiles> implements IAuthRepository {

  constructor(private readonly auditRepo: AuditRepository) {
    super(profiles, profiles.id);
  }

  private toAccount(r: any): Account {
    return {
      id: r.id,
      role: r.role as Role,
      fullName: r.fullName,
      nationalId: r.nationalId,
      isActive: r.isActive ?? true,
      passwordHash: r.passwordHash,
    };
  }

  async findAccountByNationalId(nationalId: string): Promise<Account | null> {
    const rows = await this.db
      .select({
        id: profiles.id,
        role: profiles.role,
        fullName: profiles.fullName,
        nationalId: profiles.nationalId,
        isActive: profiles.isActive,
        passwordHash: profiles.passwordHash,
      })
      .from(profiles)
      .where(eq(profiles.nationalId, nationalId))
      .limit(1);
    return rows[0] ? this.toAccount(rows[0]) : null;
  }

  async findAccountById(id: string): Promise<Account | null> {
    const rows = await this.db
      .select({
        id: profiles.id,
        role: profiles.role,
        fullName: profiles.fullName,
        nationalId: profiles.nationalId,
        isActive: profiles.isActive,
        passwordHash: profiles.passwordHash,
      })
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);
    return rows[0] ? this.toAccount(rows[0]) : null;
  }

  /**
   * The caller's own profile, for GET /auth/me.
   *
   * ENUMERATED, NOT `select *`. `profiles` holds `password_hash`, and a bare
   * select handed it to the route, which returned it to the browser on every
   * session start — the caller's own bcrypt hash, in a response the client
   * caches. Naming the columns is what keeps it out of the process, the same
   * rule SettingsRepository.getSettings() follows for the master password.
   */
  async getProfile(profileId: string) {
    const rows = await this.db
      .select({
        id: profiles.id,
        role: profiles.role,
        fullName: profiles.fullName,
        nationalId: profiles.nationalId,
        phone: profiles.phone,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
        isActive: profiles.isActive,
        permissions: profiles.permissions,
        createdBy: profiles.createdBy,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getMemberProfile(profileId: string) {
    const rows = await this.db
      .select({
        member: members,
        branch: branches,
        group: groups,
        institution: institutions,
        // Drizzle's own exists() over a query-builder subquery. Correlated on
        // members.id, so it reads as a column of this row — which is what it is.
        //
        // mapWith(Boolean) because exists() is typed SQL<unknown>: in a WHERE
        // clause nobody asks what it returns, but selected as a column it is a
        // boolean, and saying so is what keeps `unknown` out of /auth/me.
        is_enrolled: exists(
          new QueryBuilder()
            .select({ id: faceTemplates.memberId })
            .from(faceTemplates)
            .where(eq(faceTemplates.memberId, members.id)),
        ).mapWith(Boolean)
      })
      .from(members)
      .leftJoin(branches, eq(branches.id, members.branchId))
      .leftJoin(groups, eq(groups.id, members.groupId))
      .leftJoin(institutions, eq(institutions.id, groups.institutionId))
      .where(eq(members.profileId, profileId))
      .limit(1);

    if (!rows[0]) return undefined;
    const { member, branch, group, institution, is_enrolled } = rows[0];
    
    return {
      ...member,
      branch: branch || null,
      group: group ? { ...group, institution: institution ? { name: institution.name } : null } : null,
      is_enrolled,
    };
  }

  async storePasswordHash(profileId: string, hash: string): Promise<number> {
    const result = await this.db
      .update(profiles)
      .set({ passwordHash: hash })
      .where(eq(profiles.id, profileId))
      .returning({ id: profiles.id });
    return result.length;
  }

  async readMasterPasswordHash(): Promise<string | null> {
    const rows = await this.db
      .select({ masterPasswordHash: appSettings.masterPasswordHash })
      .from(appSettings)
      .where(eq(appSettings.id, 1));
    return rows[0]?.masterPasswordHash || null;
  }

  async writeMasterPasswordHash(hash: string | null): Promise<void> {
    await this.db
      .update(appSettings)
      .set({ masterPasswordHash: hash })
      .where(eq(appSettings.id, 1));
  }

  /** Delegates to the one writer — see AuditRepository.record(). */
  async audit(actorId: string | null, event: string, detail: JsonValue): Promise<void> {
    await this.auditRepo.record(actorId, event, detail);
  }

  async findTokenByHash(tokenHash: string): Promise<StoredToken | null> {
    const rows = await this.db
      .select({
        id: refreshTokens.id,
        profileId: refreshTokens.profileId,
        familyId: refreshTokens.familyId,
        expiresAt: refreshTokens.expiresAt,
        rotatedAt: refreshTokens.rotatedAt,
        revokedAt: refreshTokens.revokedAt,
      })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      profileId: r.profileId,
      familyId: r.familyId,
      expiresAt: new Date(r.expiresAt),
      rotatedAt: r.rotatedAt ? new Date(r.rotatedAt) : null,
      revokedAt: r.revokedAt ? new Date(r.revokedAt) : null,
    };
  }

  async insertToken(row: {
    profileId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
  }): Promise<void> {
    await this.db.insert(refreshTokens).values({
      profileId: row.profileId,
      familyId: row.familyId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt.toISOString(),
      userAgent: row.userAgent,
    });
  }

  async markTokenRotated(id: string): Promise<boolean> {
    const rows = await this.db
      .update(refreshTokens)
      .set({ rotatedAt: new Date().toISOString() })
      .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.rotatedAt)))
      .returning({ id: refreshTokens.id });
    return rows.length > 0;
  }

  async revokeFamily(familyId: string): Promise<number> {
    const rows = await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date().toISOString() })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    return rows.length;
  }

  async revokeAllForProfile(profileId: string): Promise<number> {
    const rows = await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date().toISOString() })
      .where(and(eq(refreshTokens.profileId, profileId), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    return rows.length;
  }

  async createStaff(
    actorId: string,
    profileId: string,
    input: {
      national_id: string;
      full_name: string;
      phone?: string | null;
      role: Role;
      permissions?: AdminPermissions | null;
    },
    passwordHash: string,
  ): Promise<void> {
    await this.db.insert(profiles).values({
      id: profileId,
      role: input.role,
      fullName: input.full_name,
      nationalId: input.national_id,
      phone: input.phone || null,
      passwordHash,
      createdBy: actorId,
      // A superadmin's column is never read (PermissionsGuard passes them by
      // role), so it is not written either.
      permissions: input.role === Role.ADMIN ? (input.permissions ?? null) : null,
    });
  }

  async createAdminAssignment(adminId: string, groupId: string | null, branchId: string | null): Promise<void> {
    await this.db.insert(adminAssignments).values({
      adminId,
      groupId,
      branchId,
    });
  }

  async deleteProfile(profileId: string): Promise<void> {
    await this.db.delete(profiles).where(eq(profiles.id, profileId));
  }
}
