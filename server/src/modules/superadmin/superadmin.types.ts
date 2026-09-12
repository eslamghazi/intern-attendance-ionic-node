// The shapes the superadmin backup module moves around.

import type { SUPERADMIN_BACKUP_KIND } from '../../domain/backup/superadminBackup.js';

/**
 * The file itself — snake_case, because it is written to disk and read back by
 * `scripts/superadmin-backup.mjs` and `scripts/superadmin-restore.mjs`. The two
 * doors produce the same bytes on purpose: a file taken from the page restores
 * with the script, and the other way round.
 */
export interface SuperadminBackupFile {
  kind: typeof SUPERADMIN_BACKUP_KIND;
  version: number;
  taken_at: string;
  accounts: {
    full_name: string;
    national_id: string;
    phone: string | null;
    email: string | null;
    avatar_url: string | null;
    password_hash: string | null;
    is_active: boolean;
  }[];
}
