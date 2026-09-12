import { Injectable } from '@nestjs/common';
import { eq, and, ne } from 'drizzle-orm';
import { GenericRepository } from '../../infrastructure/database/generic.repository.js';
import { profiles } from '../../infrastructure/database/schema/index.js';
import { FIRST_SUPERADMIN } from '../../config/constants.js';
import { Role } from '../../common/enums/index.js';
import type { BackupAccount } from '../../domain/backup/superadminBackup.js';

@Injectable()
export class SuperadminRepository extends GenericRepository<typeof profiles> {
  constructor() {
    super(profiles, profiles.id);
  }

  /**
   * The superadmin accounts, WITHOUT the hash.
   *
   * What the page lists. Enumerated rather than `select *` for the reason
   * AuthRepository.getProfile is: this table holds password_hash, and a bare
   * select is how it reaches a browser.
   */
  async listForDisplay() {
    return this.db
      .select({
        id: profiles.id,
        full_name: profiles.fullName,
        national_id: profiles.nationalId,
        phone: profiles.phone,
        email: profiles.email,
        is_active: profiles.isActive,
        created_at: profiles.createdAt,
      })
      .from(profiles)
      // The seeded account is nobody's business — see isHiddenAccount.
      .where(and(eq(profiles.role, Role.SUPERADMIN), ne(profiles.nationalId, FIRST_SUPERADMIN.nationalId)))
      .orderBy(profiles.createdAt);
  }

  /**
   * The same accounts WITH the hash, for a backup.
   *
   * Separate from listForDisplay on purpose: the hash is the reason a backup
   * file is a secret, and a single method used for both would put it in every
   * response that only wanted to show a name.
   */
  async listForBackup() {
    return this.db
      .select({
        fullName: profiles.fullName,
        nationalId: profiles.nationalId,
        phone: profiles.phone,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
        passwordHash: profiles.passwordHash,
        isActive: profiles.isActive,
      })
      .from(profiles)
      // Not in the backup either: it is re-created by the API when no
      // superadmin exists, which is the one recovery it is for.
      .where(and(eq(profiles.role, Role.SUPERADMIN), ne(profiles.nationalId, FIRST_SUPERADMIN.nationalId)))
      .orderBy(profiles.createdAt);
  }

  /** Whoever holds this national id, whatever their role. */
  async findByNationalId(nationalId: string) {
    const rows = await this.db
      .select({ id: profiles.id, role: profiles.role })
      .from(profiles)
      .where(eq(profiles.nationalId, nationalId))
      .limit(1);
    return rows[0] ?? null;
  }

  async insertSuperadmin(a: BackupAccount): Promise<void> {
    await this.db.insert(profiles).values({
      role: Role.SUPERADMIN,
      fullName: a.fullName,
      nationalId: a.nationalId,
      phone: a.phone,
      email: a.email,
      avatarUrl: a.avatarUrl,
      passwordHash: a.passwordHash,
      isActive: a.isActive,
    });
  }

  async overwriteSuperadmin(id: string, a: BackupAccount): Promise<void> {
    await this.db
      .update(profiles)
      .set({
        role: Role.SUPERADMIN,
        fullName: a.fullName,
        phone: a.phone,
        email: a.email,
        avatarUrl: a.avatarUrl,
        passwordHash: a.passwordHash,
        isActive: a.isActive,
      })
      .where(eq(profiles.id, id));
  }
}
