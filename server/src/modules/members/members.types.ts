// The shapes the members module reads and writes.
//
// Declared apart from the repository so a caller can see what it will get
// back without reading the query that produces it.
import type { MEMBER_COLUMN } from '../../config/constants.js';
import type {
  ColumnPatch,
  Guaranteed,
  SelectedRow,
} from '../../infrastructure/database/row.types.js';
import type {
  DIRECTORY_COLUMNS,
  DIRECTORY_NOT_NULL,
  LOOKUP_COLUMNS,
  MEMBER_PAGE_COLUMNS,
} from './members.columns.js';
import type { members, profiles } from '../../infrastructure/database/schema/index.js';
import type { UpdateMemberDto } from './dto/member.dto.js';

/**
 * A row of the admin members grid.
 *
 * Derived from DIRECTORY_COLUMNS — the very object the query is built from — so
 * the query and this type cannot name different columns. `Guaranteed` then
 * un-nulls the ones the view's SQL promises; see DIRECTORY_NOT_NULL for which,
 * and why.
 */
export type DirectorySelection = SelectedRow<typeof DIRECTORY_COLUMNS>;

export type DirectoryRow = Guaranteed<
  DirectorySelection,
  (typeof DIRECTORY_NOT_NULL)[number]
>;

/** One line of the member picker. Same derivation as DirectoryRow. */
export type MemberPageItem = Guaranteed<
  SelectedRow<typeof MEMBER_PAGE_COLUMNS>,
  'member_id' | 'full_name' | 'national_id'
>;

export interface ItemResult {
  national_id: string;
  ok: boolean;
  updated?: boolean;
  error?: string;
}

export interface MemberInput {
  national_id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  group_id: string;
  branch_id: string;
}

// --- Patches -----------------------------------------------------------------
//
// Two vocabularies, kept apart on purpose. A *Field* patch is what arrived over
// the wire (snake_case, the public contract). A *Patch* is what goes to Drizzle
// (the schema's camelCase names). Nothing may cross without going through
// MembersMapper.toMemberPatch / toProfilePatch.

/** A partial update for `members`, in schema names. */
export type MemberPatch = ColumnPatch<typeof members>;

/** A partial update for `profiles`, in schema names. */
export type ProfilePatch = ColumnPatch<typeof profiles>;

/** A patchable member field, in wire names. */
export type MemberField = keyof typeof MEMBER_COLUMN;

/** What a bulk edit may change, in wire names. */
export type MemberFieldPatch = Partial<Pick<UpdateMemberDto, MemberField>>;

// --- GET /members/lookup -----------------------------------------------------
//
// Every column is nullable because every column of `member_directory` is: it is
// a view over left joins, so a member whose branch was deleted still has a row
// and simply has no branch name. Saying so here is what stops a screen from
// rendering "undefined" where a hospital should be.

export type LookupRow = SelectedRow<typeof LOOKUP_COLUMNS>;

/**
 * The answer to a faculty-wide lookup.
 *
 * `found: false` rather than a 404, because "no such code" is an ordinary answer
 * to a typed-in identifier and not an error. `in_scope` says whether the member
 * is one of the caller's own — the screen shows the difference, and a lookup
 * outside the caller's assignments is audited.
 */
export type LookupResult =
  | { found: false }
  | { found: true; in_scope: boolean; member: LookupRow };
