import { Injectable } from '@nestjs/common';
import { GenericRepository } from '../../infrastructure/database/generic.repository.js';
import { eq } from 'drizzle-orm';
import { appSettings } from '../../infrastructure/database/schema/index.js';

type AppSettings = typeof appSettings.$inferSelect;
type AppSettingsInsert = typeof appSettings.$inferInsert;

import type { ISettingsRepository } from './interfaces/settings.interface.js';

@Injectable()
export class SettingsRepository extends GenericRepository<typeof appSettings, number> implements ISettingsRepository {
  constructor() {
    super(appSettings, appSettings.id);
  }

  /**
   * The settings row, minus the secret.
   *
   * ENUMERATED, NOT `select *`. app_settings holds master_password_hash — the
   * bcrypt hash of the shared password that opens every member and admin
   * account — and this row is what GET /api/v1/settings answers with.
   *
   * A `select *` here would rely on the response mapper's field list to keep the
   * hash out of the reply — one careless `return row` away from handing it to
   * every signed-in student, and no test would catch it.
   *
   * Not selecting it cannot be undone by accident: the hash never enters the
   * process at all, whatever a route does with what it gets back. Adding a
   * column to this list is a deliberate act, and one missing from it fails
   * loudly the first time something reads it.
   */
  async getSettings() {
    const rows = await this.db
      .select({
        id: appSettings.id,
        faceMatchThreshold: appSettings.faceMatchThreshold,
        livenessRequired: appSettings.livenessRequired,
        livenessMode: appSettings.livenessMode,
        defaultRadiusMeters: appSettings.defaultRadiusMeters,
        maxAccuracyMeters: appSettings.maxAccuracyMeters,
        shiftStart: appSettings.shiftStart,
        shiftEnd: appSettings.shiftEnd,
        lateGraceMinutes: appSettings.lateGraceMinutes,
        requirePlayIntegrity: appSettings.requirePlayIntegrity,
        bypassFace: appSettings.bypassFace,
        bypassLocation: appSettings.bypassLocation,
        bypassCheckoutWindow: appSettings.bypassCheckoutWindow,
        storeFaceImages: appSettings.storeFaceImages,
        storeProbeImages: appSettings.storeProbeImages,
        captureHoldSeconds: appSettings.captureHoldSeconds,
        qrRequiresMember: appSettings.qrRequiresMember,
        qrAllowImage: appSettings.qrAllowImage,
        qrValiditySeconds: appSettings.qrValiditySeconds,
        qrBypassMinutes: appSettings.qrBypassMinutes,
        enforceShiftWindow: appSettings.enforceShiftWindow,
        allowCheckoutOnly: appSettings.allowCheckoutOnly,
        autoLeaveWork: appSettings.autoLeaveWork,
        orgName: appSettings.orgName,
        orgLogoUrl: appSettings.orgLogoUrl,
        terminology: appSettings.terminology,
        memberPhotos: appSettings.memberPhotos,
        showOutOfRangeMap: appSettings.showOutOfRangeMap,
        blockDevOptions: appSettings.blockDevOptions,
        locationIpMaxKm: appSettings.locationIpMaxKm,
        webDetectFrozenGps: appSettings.webDetectFrozenGps,
        checkinMethod: appSettings.checkinMethod,
      })
      .from(appSettings)
      .where(eq(appSettings.id, 1));
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

  async updateSettings(updateObj: Partial<AppSettingsInsert>) {
    await this.update(1, updateObj);
  }
}
