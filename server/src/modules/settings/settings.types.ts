// The shapes the settings module writes.

import type { ColumnPatch } from '../../infrastructure/database/row.types.js';
import type { appSettings } from '../../infrastructure/database/schema/index.js';

/** A partial update for the single app-settings row, in schema names. */
export type SettingsPatch = ColumnPatch<typeof appSettings>;
