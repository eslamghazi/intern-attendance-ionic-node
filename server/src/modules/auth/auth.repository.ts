import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../common/database/generic.repository.js';
import { eq, sql, isNull, and } from 'drizzle-orm';
import { profiles, appSettings, refreshTokens, auditLog, adminAssignments, members, branches, groups, institutions } from '../../db/schema/index.js';
import type { Role } from '../../domain/identity/role.js';
import type { StoredRefreshToken } from '../../domain/auth/refresh.js';
import type { IAuthRepository } from './interfaces/auth.interface.js';

export interface Account {
  id: string;
  role: Role;
  fullName: string;
  nationalId: string;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordHash: string | null;
}

export interface StoredToken extends StoredRefreshToken {
  id: string;
}

@Injectable()
export class AuthRepository extends GenericRepository<
  typeof profiles.$inferSelect,
  string,
  typeof profiles.$inferInsert,
  Partial<typeof profiles.$inferInsert>
> implements IAuthRepository {

  constructor() {
    super(profiles, profiles.id);
  }

  private toAccount(r: any): Account {
    return {
      id: r.id,
      role: r.role as Role,
      fullName: r.fullName,
      nationalId: r.nationalId,
      isActive: r.isActive ?? true,
      mustChangePassword: r.mustChangePassword ?? false,
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
        mustChangePassword: profiles.mustChangePassword,
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
        mustChangePassword: profiles.mustChangePassword,
        passwordHash: profiles.passwordHash,
      })
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);
    return rows[0] ? this.toAccount(rows[0]) : null;
  }

  async getProfile(profileId: string) {
    const rows = await this.db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
    return rows[0] ?? null;
  }

  async getMemberProfile(profileId: string) {
    const rows = await this.db
      .select({
        member: members,
        branch: branches,
        group: groups,
        institution: institutions,
        is_enrolled: sql<boolean>`exists (select 1 from face_templates ft where ft.member_id = ${members.id})`
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

  async storePasswordHash(
    profileId: string,
    hash: string,
    mustChangePassword: boolean,
  ): Promise<number> {
    const result = await this.db
      .update(profiles)
      .set({ passwordHash: hash, mustChangePassword })
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

  async audit(actorId: string, event: string, detail: unknown): Promise<void> {
    try {
      await this.db.insert(auditLog).values({
        actorId,
        event: event as any,
        detail,
      });
    } catch {
      /* ignore */
    }
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
      role: 'admin';
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
      mustChangePassword: true,
      createdBy: actorId,
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
