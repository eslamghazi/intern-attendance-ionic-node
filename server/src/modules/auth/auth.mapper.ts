import { LoginResultDto } from './dto/auth.dto.js';
import { LoginResult } from './auth.service.js';
import type {
  MeBranch,
  MeGroup,
  MeMember,
  MeProfile,
  MeResponse,
  ProfileColumns,
  MemberContextColumns,
} from './auth.types.js';

export class AuthMapper {
  static toLoginResultDto(result: LoginResult): LoginResultDto {
    return new LoginResultDto({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
      token_type: result.token_type,
      role: result.role,
      profile: result.profile,
    });
  }

  /**
   * The database's column names into the API's field names.
   *
   * Written out rather than passed through a generic camel-to-snake helper: this
   * is the API's contract with its client, and a contract that is computed from
   * whatever the schema happens to be called changes silently when a column is
   * renamed. Here a rename is a compile error.
   */
  static toMeProfile(row: ProfileColumns): MeProfile {
    return {
      id: row.id,
      role: row.role,
      full_name: row.fullName,
      national_id: row.nationalId,
      phone: row.phone,
      email: row.email,
      avatar_url: row.avatarUrl,
      is_active: row.isActive,
      permissions: row.permissions ?? null,
      created_by: row.createdBy,
      created_at: row.createdAt,
    };
  }

  static toMeMember(row: MemberContextColumns): MeMember {
    const branch: MeBranch | null = row.branch
      ? {
          id: row.branch.id,
          name: row.branch.name,
          address: row.branch.address,
          latitude: row.branch.latitude,
          longitude: row.branch.longitude,
          radius_meters: row.branch.radiusMeters,
          area_coords: row.branch.areaCoords ?? null,
          is_active: row.branch.isActive,
          bypass_face: row.branch.bypassFace,
          bypass_location: row.branch.bypassLocation,
          bypass_checkout_window: row.branch.bypassCheckoutWindow,
          qr_enabled: row.branch.qrEnabled,
          require_qr: row.branch.requireQr,
          block_checkin: row.branch.blockCheckin,
        }
      : null;

    const group: MeGroup | null = row.group
      ? {
          id: row.group.id,
          name: row.group.name,
          year: row.group.year,
          is_active: row.group.isActive,
          bypass_face: row.group.bypassFace,
          bypass_location: row.group.bypassLocation,
          bypass_checkout_window: row.group.bypassCheckoutWindow,
          institution_name: row.group.institutionName,
          institution: row.group.institution,
        }
      : null;

    return {
      id: row.id,
      profile_id: row.profileId,
      group_id: row.groupId,
      branch_id: row.branchId,
      member_code: row.memberCode,
      enrollment_status: row.enrollmentStatus,
      is_active: row.isActive,
      bypass_face: row.bypassFace,
      bypass_location: row.bypassLocation,
      bypass_checkout_window: row.bypassCheckoutWindow,
      frozen_at: row.frozenAt,
      can_generate_qr: row.canGenerateQr,
      can_make_roster: row.canMakeRoster,
      can_reset_face: row.canResetFace,
      created_at: row.createdAt,
      branch,
      group,
      is_enrolled: row.is_enrolled,
    };
  }

  static toMeResponse(
    profile: ProfileColumns | null,
    member: MemberContextColumns | null,
  ): MeResponse {
    return {
      profile: profile ? AuthMapper.toMeProfile(profile) : null,
      member: member ? AuthMapper.toMeMember(member) : null,
      is_enrolled: Boolean(member?.is_enrolled),
    };
  }
}
