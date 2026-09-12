// What a superadmin backup carries.

/**
 * One account as a backup file records it.
 *
 * The password HASH, not a password: a restore brings an account back as it
 * was, with the credential its owner already knows, rather than as a new
 * account somebody then has to be told the password for.
 */
export interface BackupAccount {
  nationalId: string;
  fullName: string;
  /** bcrypt. This is why a backup file is a secret. */
  passwordHash: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  isActive: boolean;
}

/** A file that was read, or the reason it could not be. */
export type ParsedBackup =
  | { ok: true; accounts: BackupAccount[] }
  | { ok: false; why: string };

/** What happened to one account during a restore. */
export type RestoreOutcome = 'added' | 'overwritten' | 'skipped';

export interface RestoreLine {
  national_id: string;
  full_name: string;
  outcome: RestoreOutcome;
  /** Why it was skipped — shown next to the row. */
  reason?: string;
}

export interface RestoreReport {
  added: number;
  overwritten: number;
  skipped: number;
  accounts: RestoreLine[];
}
