// The columns each members query reads, as the objects the queries are built
// from.
//
// A selection map is a value, so it cannot live in members.types.ts — but the
// row types in there are DERIVED from these maps (see SelectedRow), which is the
// point of keeping them somewhere both can import. Previously the query listed
// its columns and the interface listed them again, and nothing checked that the
// two lists agreed; a renamed column changed the query and left the interface
// promising a field that no longer arrived, with an `as unknown as` in between
// so the compiler never saw it.
import { memberDirectory } from '../../infrastructure/database/schema/index.js';
/** The admin members grid. */
export const DIRECTORY_COLUMNS = {
    member_id: memberDirectory.memberId,
    profile_id: memberDirectory.profileId,
    group_id: memberDirectory.groupId,
    branch_id: memberDirectory.branchId,
    is_active: memberDirectory.isActive,
    bypass_face: memberDirectory.bypassFace,
    bypass_location: memberDirectory.bypassLocation,
    bypass_checkout_window: memberDirectory.bypassCheckoutWindow,
    frozen_at: memberDirectory.frozenAt,
    can_generate_qr: memberDirectory.canGenerateQr,
    can_make_roster: memberDirectory.canMakeRoster,
    can_reset_face: memberDirectory.canResetFace,
    has_face: memberDirectory.hasFace,
    member_code: memberDirectory.memberCode,
    full_name: memberDirectory.fullName,
    national_id: memberDirectory.nationalId,
    phone: memberDirectory.phone,
    email: memberDirectory.email,
    avatar_url: memberDirectory.avatarUrl,
    group_name: memberDirectory.groupName,
    branch_name: memberDirectory.branchName,
};
/** The member picker: enough to identify somebody, and nothing else. */
export const MEMBER_PAGE_COLUMNS = {
    member_id: memberDirectory.memberId,
    full_name: memberDirectory.fullName,
    national_id: memberDirectory.nationalId,
    member_code: memberDirectory.memberCode,
};
/** One member, looked up faculty-wide by code or national id. */
export const LOOKUP_COLUMNS = {
    member_id: memberDirectory.memberId,
    profile_id: memberDirectory.profileId,
    member_code: memberDirectory.memberCode,
    national_id: memberDirectory.nationalId,
    full_name: memberDirectory.fullName,
    phone: memberDirectory.phone,
    email: memberDirectory.email,
    avatar_url: memberDirectory.avatarUrl,
    branch_id: memberDirectory.branchId,
    branch_name: memberDirectory.branchName,
    group_id: memberDirectory.groupId,
    group_name: memberDirectory.groupName,
    group_year: memberDirectory.groupYear,
    institution_name: memberDirectory.institutionName,
    is_active: memberDirectory.isActive,
    enrollment_status: memberDirectory.enrollmentStatus,
    has_face: memberDirectory.hasFace,
    frozen_at: memberDirectory.frozenAt,
    bypass_face: memberDirectory.bypassFace,
    bypass_location: memberDirectory.bypassLocation,
    can_generate_qr: memberDirectory.canGenerateQr,
    can_make_roster: memberDirectory.canMakeRoster,
    can_reset_face: memberDirectory.canResetFace,
};
/**
 * The columns `member_directory` can never return null for.
 *
 * Drizzle reads a view as all-nullable because a view declaration carries no
 * NOT NULL information. The view's own SQL says otherwise, and this is the list
 * of places it does — checked against the query it describes:
 *
 *   FROM members i JOIN profiles p ON p.id = i.profile_id
 *
 * An INNER join onto `profiles`, so `full_name` and `national_id` — both NOT
 * NULL on that table — are present in every row the view can produce. The rest
 * are NOT NULL columns of `members` itself, or `has_face`, which is an EXISTS
 * and is therefore always true or false.
 *
 * Everything absent from this list stays nullable, and for real reasons:
 * `frozen_at` is a clock most members do not have, `member_code` is assigned
 * later, and `group_name` / `branch_name` come through LEFT JOINs.
 */
export const DIRECTORY_NOT_NULL = [
    'member_id',
    'profile_id',
    'group_id',
    'branch_id',
    'is_active',
    'bypass_face',
    'bypass_location',
    'bypass_checkout_window',
    'can_generate_qr',
    'can_make_roster',
    'can_reset_face',
    'has_face',
    'full_name',
    'national_id',
];
//# sourceMappingURL=members.columns.js.map