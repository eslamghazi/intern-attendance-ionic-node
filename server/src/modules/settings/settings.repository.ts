import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../common/database/generic.repository.js';
import { eq } from 'drizzle-orm';
import { appSettings } from '../../db/schema/index.js';

type AppSettings = typeof appSettings.$inferSelect;
type AppSettingsInsert = typeof appSettings.$inferInsert;

import type { ISettingsRepository } from './interfaces/settings.interface.js';

@Injectable()
export class SettingsRepository extends GenericRepository<AppSettings, number, AppSettingsInsert, Partial<AppSettingsInsert>> implements ISettingsRepository {
  constructor() {
    super(appSettings, appSettings.id);
  }

  async getSettings() {
    return this.findById(1);
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

  async updateSettings(updateObj: Partial<AppSettingsInsert>) {
    await this.update(1, updateObj);
  }
}
