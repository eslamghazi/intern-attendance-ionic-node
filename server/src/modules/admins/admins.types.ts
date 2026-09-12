// The shapes the admins module reads and writes.
//
// An "admin" is not a table: it is a row in `profiles` whose role is admin or
// superadmin, so an admin patch is a profiles patch. Declared here rather than
// borrowed from the members module, because the two happen to share a table and
// share nothing else.

import type { ColumnPatch } from '../../infrastructure/database/row.types.js';
import type { profiles } from '../../infrastructure/database/schema/index.js';

/** A partial update for an admin's profile, in schema names. */
export type AdminPatch = ColumnPatch<typeof profiles>;
