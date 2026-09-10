import { BrandingResponseDto, SettingsResponseDto } from './dto/settings.dto.js';
export class SettingsMapper {
    static toBrandingDto(row) {
        if (!row)
            return null;
        const dto = new BrandingResponseDto();
        dto.org_name = row.orgName ?? null;
        dto.org_logo_url = row.orgLogoUrl ?? null;
        dto.terminology = row.terminology ?? null;
        dto.member_photos = row.memberPhotos ?? null;
        return dto;
    }
    static toResponseDto(row) {
        if (!row)
            return null;
        const dto = new SettingsResponseDto();
        dto.face_match_threshold = row.faceMatchThreshold ? Number(row.faceMatchThreshold) : null;
        dto.liveness_required = row.livenessRequired ?? null;
        dto.liveness_mode = row.livenessMode ?? null;
        dto.default_radius_meters = row.defaultRadiusMeters ?? null;
        dto.max_accuracy_meters = row.maxAccuracyMeters ?? null;
        dto.late_grace_minutes = row.lateGraceMinutes ?? null;
        dto.require_play_integrity = row.requirePlayIntegrity ?? null;
        dto.bypass_face = row.bypassFace ?? null;
        dto.bypass_location = row.bypassLocation ?? null;
        dto.store_face_images = row.storeFaceImages ?? null;
        dto.store_probe_images = row.storeProbeImages ?? null;
        dto.qr_requires_member = row.qrRequiresMember ?? null;
        dto.qr_allow_image = row.qrAllowImage ?? null;
        dto.qr_validity_seconds = row.qrValiditySeconds ?? null;
        dto.qr_bypass_minutes = row.qrBypassMinutes ?? null;
        dto.enforce_shift_window = row.enforceShiftWindow ?? null;
        dto.auto_leave_work = row.autoLeaveWork ?? null;
        dto.bypass_checkout_window = row.bypassCheckoutWindow ?? null;
        dto.capture_hold_seconds = row.captureHoldSeconds ?? null;
        dto.org_name = row.orgName ?? null;
        dto.org_logo_url = row.orgLogoUrl ?? null;
        dto.terminology = row.terminology ?? null;
        dto.member_photos = row.memberPhotos ?? null;
        dto.show_out_of_range_map = row.showOutOfRangeMap ?? null;
        dto.block_dev_options = row.blockDevOptions ?? null;
        dto.location_ip_max_km = row.locationIpMaxKm ? Number(row.locationIpMaxKm) : null;
        dto.web_detect_frozen_gps = row.webDetectFrozenGps ?? null;
        dto.checkin_method = row.checkinMethod ?? null;
        return dto;
    }
}
//# sourceMappingURL=settings.mapper.js.map