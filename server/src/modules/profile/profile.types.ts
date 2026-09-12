// The shapes the profile module writes.

import type { ColumnPatch } from '../../infrastructure/database/row.types.js';
import type { profiles } from '../../infrastructure/database/schema/index.js';

/** A partial update for the caller's own profile, in schema names. */
export type ProfilePatch = ColumnPatch<typeof profiles>;
