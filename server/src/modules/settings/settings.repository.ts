import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository.js';
import { eq } from 'drizzle-orm';
import { appSettings } from '../../db/schema/index.js';

@Injectable()
export class SettingsRepository extends BaseRepository {
  async getSettings() {
    const rows = await this.db.select().from(appSettings).where(eq(appSettings.id, 1));
    return rows[0] ?? null;
  }

  async getBranding() {
    const rows = await this.db
      .select({
        orgName: appSettings.orgName,
        orgLogoUrl: appSettings.orgLogoUrl,
        terminology: appSettings.terminology,
        memberPhotos: appSettings.memberPhotos,
      })
      .from(appSettings)
      .where(eq(appSettings.id, 1));
    return rows[0] ?? null;
  }

  async updateSettings(updateObj: Record<string, unknown>) {
    await this.db.update(appSettings).set(updateObj).where(eq(appSettings.id, 1));
  }
}
