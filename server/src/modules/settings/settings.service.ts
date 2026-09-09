import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../common/database/unit-of-work.service.js';
import { SettingsRepository } from './settings.repository.js';
import type { Caller } from '../../domain/identity/role.js';
import type { JwtClaims } from '../../db/context.js';
import { badRequest } from '../../http/errors.js';
import { appSettings } from '../../db/schema/index.js';

@Injectable()
export class SettingsService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly repo: SettingsRepository,
  ) {}

  async getSettings(claims: JwtClaims | null) {
    return this.uow.asCaller(claims, async () => {
      return this.repo.getSettings();
    });
  }

  async getBranding() {
    return this.uow.asService(async () => {
      const row = await this.repo.getBranding();
      if (!row) return null;
      return {
        org_name: row.orgName,
        org_logo_url: row.orgLogoUrl,
        terminology: row.terminology,
        member_photos: row.memberPhotos,
      };
    });
  }

  async updateSettings(claims: JwtClaims, b: Record<string, unknown>) {
    const snakeToCamel: Record<string, keyof typeof appSettings.$inferInsert> = {
      face_match_threshold: 'faceMatchThreshold',
      liveness_required: 'livenessRequired',
      liveness_mode: 'livenessMode',
      default_radius_meters: 'defaultRadiusMeters',
      max_accuracy_meters: 'maxAccuracyMeters',
      late_grace_minutes: 'lateGraceMinutes',
      require_play_integrity: 'requirePlayIntegrity',
      bypass_face: 'bypassFace',
      bypass_location: 'bypassLocation',
      store_face_images: 'storeFaceImages',
      store_probe_images: 'storeProbeImages',
      qr_requires_member: 'qrRequiresMember',
      qr_allow_image: 'qrAllowImage',
      qr_validity_seconds: 'qrValiditySeconds',
      qr_bypass_minutes: 'qrBypassMinutes',
      enforce_shift_window: 'enforceShiftWindow',
      auto_leave_work: 'autoLeaveWork',
      bypass_checkout_window: 'bypassCheckoutWindow',
      capture_hold_seconds: 'captureHoldSeconds',
      org_name: 'orgName',
      org_logo_url: 'orgLogoUrl',
      terminology: 'terminology',
      member_photos: 'memberPhotos',
      show_out_of_range_map: 'showOutOfRangeMap',
      block_dev_options: 'blockDevOptions',
      location_ip_max_km: 'locationIpMaxKm',
      web_detect_frozen_gps: 'webDetectFrozenGps',
      checkin_method: 'checkinMethod',
    };

    const updateObj: Record<string, unknown> = {};
    for (const [snakeKey, val] of Object.entries(b)) {
      const camelKey = snakeToCamel[snakeKey];
      if (camelKey && val !== undefined) {
        updateObj[camelKey] = val;
      }
    }
    if (!Object.keys(updateObj).length) throw badRequest('empty', 'nothing to update');

    return this.uow.asCaller(claims, async () => {
      await this.repo.updateSettings(updateObj);
      return { ok: true };
    });
  }
}
