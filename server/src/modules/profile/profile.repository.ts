import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../common/database/generic.repository.js';
import { eq, sql, and, ne } from 'drizzle-orm';
import { members, profiles } from '../../db/schema/index.js';

export interface ProfileEdit {
  fullName: string;
  phone: string;
  email: string;
  nationalId: string;
  avatarUrl: string | null;
}

import type { IProfileRepository } from './interfaces/profile.interface.js';

@Injectable()
export class ProfileRepository extends GenericRepository<
  typeof profiles.$inferSelect,
  string,
  typeof profiles.$inferInsert,
  Partial<typeof profiles.$inferInsert>
> implements IProfileRepository {
  constructor() {
    super(profiles, profiles.id);
  }

  async markEnrolled(profileId: string): Promise<void> {
    await this.db
      .update(members)
      .set({ enrollmentStatus: 'enrolled' })
      .where(eq(members.profileId, profileId));
  }

  async markPasswordChanged(profileId: string): Promise<void> {
    await this.db
      .update(profiles)
      .set({ mustChangePassword: false })
      .where(eq(profiles.id, profileId));
  }

  async isNationalIdTaken(nationalId: string, excludeProfileId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.nationalId, nationalId), ne(profiles.id, excludeProfileId)))
      .limit(1);
    return rows.length > 0;
  }

  async updateOwnProfile(profileId: string, edit: ProfileEdit): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (edit.fullName !== '') updateData.fullName = edit.fullName;
    updateData.phone = edit.phone === '' ? null : edit.phone;
    updateData.email = edit.email === '' ? null : edit.email;
    if (edit.nationalId !== '') updateData.nationalId = edit.nationalId;
    if (edit.avatarUrl !== null) updateData.avatarUrl = edit.avatarUrl;
    
    await this.db
      .update(profiles)
      .set(updateData)
      .where(eq(profiles.id, profileId));
  }

  async getMemberCode(profileId: string): Promise<string | null> {
    const rows = await this.db
      .select({ memberCode: members.memberCode })
      .from(members)
      .where(eq(members.profileId, profileId))
      .limit(1);
    return rows[0]?.memberCode ?? null;
  }
}
