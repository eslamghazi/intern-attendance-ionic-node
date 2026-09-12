import { MEMBER_COLUMN, MEMBER_FIELDS } from '../../config/constants.js';
import { cairoDate } from '../../domain/clock.js';
import { MemberDto, UpdateMemberDto } from './dto/member.dto.js';
import type {
  MemberField,
  MemberFieldPatch,
  MemberPatch,
  ProfilePatch,
} from './members.types.js';

// MEMBER_COLUMN is a plain string table in constants.ts so that file stays free
// of schema imports. This line is where it meets the schema: if a column is
// renamed or a name is mistyped, the build fails here rather than at runtime,
// where Drizzle would silently drop the key. See patch.types.ts.
const MEMBER_COLUMN_CHECKED: Record<MemberField, keyof MemberPatch> = MEMBER_COLUMN;

export class MembersMapper {
  static toDto(entity: any): MemberDto {
    return new MemberDto({
      id: entity.id,
      full_name: entity.full_name ?? entity.fullName,
      national_id: entity.national_id ?? entity.nationalId,
      phone: entity.phone,
      email: entity.email,
      avatar_url: entity.avatar_url ?? entity.avatarUrl,
      group_id: entity.group_id ?? entity.groupId,
      branch_id: entity.branch_id ?? entity.branchId,
      is_active: entity.is_active ?? entity.isActive,
      bypass_face: entity.bypass_face ?? entity.bypassFace,
      bypass_location: entity.bypass_location ?? entity.bypassLocation,
      bypass_checkout_window: entity.bypass_checkout_window ?? entity.bypassCheckoutWindow,
      frozen_at: (entity.frozen_at ?? entity.frozenAt) ? cairoDate(entity.frozen_at ?? entity.frozenAt) : null,
      can_generate_qr: entity.can_generate_qr ?? entity.canGenerateQr,
      can_make_roster: entity.can_make_roster ?? entity.canMakeRoster,
      can_reset_face: entity.can_reset_face ?? entity.canResetFace,
      group: entity.group ? { name: entity.group.name ?? entity.group } : null,
      branch: entity.branch ? { name: entity.branch.name ?? entity.branch } : null,
    });
  }

  /**
   * A wire patch -> a `members` patch.
   *
   * Only the fields actually present are carried across: `undefined` means
   * "leave it alone", and writing it would clear a column instead. `null` is a
   * value in its own right — unfreezing a member is `frozen_at: null` — so the
   * test is `!== undefined`, never truthiness.
   */
  static toMemberPatch(input: MemberFieldPatch): MemberPatch {
    const patch: MemberPatch = {};
    for (const field of MEMBER_FIELDS) {
      const value = input[field];
      if (value !== undefined) Object.assign(patch, { [MEMBER_COLUMN_CHECKED[field]]: value });
    }
    return patch;
  }

  /**
   * The `profiles` half of a member edit.
   *
   * Written out rather than table-driven, because these five do not share one
   * rule: the edit form submits the whole person, so a phone box left empty
   * means "no phone" and is stored as NULL — while an absent `avatar_url` means
   * the caller was not editing the picture and the existing one stands.
   */
  static toProfilePatch(body: UpdateMemberDto): ProfilePatch {
    const patch: ProfilePatch = {
      fullName: body.full_name,
      nationalId: body.national_id,
      phone: body.phone || null,
      email: body.email || null,
    };
    if (body.avatar_url !== undefined) patch.avatarUrl = body.avatar_url;
    return patch;
  }
}
