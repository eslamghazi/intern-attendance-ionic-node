// What a superadmin backup file is, and whether this one is any good.
//
// The file is produced in two places — `npm run superadmin:backup` and the
// Backup page — and consumed in two more. So the shape is stated once, here,
// and the parsing is a pure function: an operator uploads a file somebody sent
// them, and "is this actually a backup of ours" has to be answered before a
// single row is written.
//
// IT VALIDATES, IT DOES NOT TRUST. Everything in the file came from outside:
// the account list is checked field by field, and anything that is not a
// complete account is refused by name rather than inserted as a half row.
import type { JsonObject, JsonValue } from '../../common/json.types.js';
import type { BackupAccount, ParsedBackup } from './types.js';
export type { BackupAccount, ParsedBackup } from './types.js';

/** Stamped into every file, so a restore can tell one from a stray JSON. */
export const SUPERADMIN_BACKUP_KIND = 'intern-attendance/superadmin-backup';
export const SUPERADMIN_BACKUP_VERSION = 1;

const str = (v: JsonValue | undefined): string | null => (typeof v === 'string' ? v : null);
const nullableStr = (v: JsonValue | undefined): string | null =>
  typeof v === 'string' ? v : null;

/**
 * Read a backup, or say what is wrong with it.
 *
 * The `why` is shown to whoever uploaded the file, so it names the thing they
 * can act on — which file this is, or which account in it is incomplete — never
 * "invalid input".
 */
export function parseSuperadminBackup(value: JsonValue): ParsedBackup {
  const bad = (why: string): ParsedBackup => ({ ok: false, why });

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return bad('the file is not a JSON object');
  }
  const root = value as JsonObject;

  if (root.kind !== SUPERADMIN_BACKUP_KIND) {
    return bad(
      `this is not a superadmin backup (expected kind "${SUPERADMIN_BACKUP_KIND}", got ` +
        `${typeof root.kind === 'string' ? `"${root.kind}"` : 'nothing'})`,
    );
  }
  if (typeof root.version !== 'number' || root.version > SUPERADMIN_BACKUP_VERSION) {
    return bad(
      `this backup is version ${String(root.version)}, and this server understands up to ` +
        `${SUPERADMIN_BACKUP_VERSION} — use a newer server to restore it`,
    );
  }
  if (!Array.isArray(root.accounts)) return bad('the file carries no accounts list');
  if (!root.accounts.length) return bad('the backup is empty — there is nothing to restore');

  const accounts: BackupAccount[] = [];
  for (const [i, raw] of root.accounts.entries()) {
    const at = `account ${i + 1}`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad(`${at} is not an object`);
    const a = raw as JsonObject;

    const nationalId = str(a.national_id);
    const fullName = str(a.full_name);
    const passwordHash = str(a.password_hash);

    if (!nationalId) return bad(`${at} has no national_id`);
    if (!fullName) return bad(`${at} (${nationalId}) has no full_name`);
    // Without the hash a restored account has no password and nobody can sign
    // in as it — which looks like a successful restore and is not one.
    if (!passwordHash) return bad(`${at} (${nationalId}) has no password_hash`);

    accounts.push({
      nationalId,
      fullName,
      passwordHash,
      phone: nullableStr(a.phone),
      email: nullableStr(a.email),
      avatarUrl: nullableStr(a.avatar_url),
      isActive: typeof a.is_active === 'boolean' ? a.is_active : true,
    });
  }

  const seen = new Set<string>();
  for (const a of accounts) {
    if (seen.has(a.nationalId)) {
      return bad(`the backup lists ${a.nationalId} twice`);
    }
    seen.add(a.nationalId);
  }

  return { ok: true, accounts };
}
