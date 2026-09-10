import { MemberDto } from './dto/member.dto.js';
import { cairoDate } from '../../domain/clock.js';
export class MembersMapper {
    static toDto(entity) {
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
}
//# sourceMappingURL=members.mapper.js.map