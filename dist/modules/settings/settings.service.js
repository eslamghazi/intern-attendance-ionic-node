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
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { SettingsRepository } from './settings.repository.js';
import { badRequest } from '../../common/errors.js';
import { SettingsMapper } from './settings.mapper.js';
import { BrandingResponseDto } from './dto/settings.dto.js';
let SettingsService = class SettingsService {
    uow;
    repo;
    constructor(uow, repo) {
        this.uow = uow;
        this.repo = repo;
    }
    async getSettings() {
        return this.uow.transaction(async () => {
            const row = await this.repo.getSettings();
            return SettingsMapper.toResponseDto(row);
        });
    }
    async getBranding() {
        try {
            return await this.uow.transaction(async () => {
                const row = await this.repo.getBranding();
                const dto = SettingsMapper.toBrandingDto(row);
                if (dto) {
                    if (!dto.org_name && process.env.ORG_NAME)
                        dto.org_name = process.env.ORG_NAME;
                    if (!dto.org_logo_url && process.env.ORG_LOGO_URL)
                        dto.org_logo_url = process.env.ORG_LOGO_URL;
                    if (!dto.terminology && process.env.TERMINOLOGY)
                        dto.terminology = process.env.TERMINOLOGY;
                    return dto;
                }
                return this.getEnvBranding();
            });
        }
        catch {
            return this.getEnvBranding();
        }
    }
    getEnvBranding() {
        if (!process.env.ORG_NAME && !process.env.ORG_LOGO_URL && !process.env.TERMINOLOGY) {
            return null;
        }
        const dto = new BrandingResponseDto();
        dto.org_name = process.env.ORG_NAME ?? null;
        dto.org_logo_url = process.env.ORG_LOGO_URL ?? null;
        dto.terminology = process.env.TERMINOLOGY ?? null;
        dto.member_photos = process.env.MEMBER_PHOTOS === 'false' ? false : null;
        return dto;
    }
    async updateSettings(dto) {
        // Every field of the DTO must appear here: `Record<keyof UpdateSettingsDto>`
        // makes a forgotten setting a build failure rather than one that silently
        // never saves.
        const snakeToCamel = {
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
        // Driven by the map, not by the body: a key the map does not know is not a
        // column, and Drizzle would drop it from the statement without a word — so
        // an unmapped setting would report saved and change nothing.
        const updateObj = {};
        for (const field of Object.keys(snakeToCamel)) {
            const value = dto[field];
            if (value !== undefined)
                Object.assign(updateObj, { [snakeToCamel[field]]: value });
        }
        if (!Object.keys(updateObj).length)
            throw badRequest('empty', 'nothing to update');
        return this.uow.transaction(async () => {
            await this.repo.updateSettings(updateObj);
            return { ok: true };
        });
    }
};
SettingsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        SettingsRepository])
], SettingsService);
export { SettingsService };
//# sourceMappingURL=settings.service.js.map