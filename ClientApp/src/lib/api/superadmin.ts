// Backing up and restoring the accounts that can do everything.
//
// Superadmin only, enforced on the server — these routes read and write the
// credentials of the accounts that could grant themselves anything.
import { apiFetch, getToken } from './http';
import { env } from '../env';
import { STORAGE_KEYS } from '../config';
import { downloadBlob } from '../download';
import type { JsonValue } from '../json.types';

export interface SuperadminAccount {
  id: string;
  full_name: string;
  national_id: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export type RestoreOutcome = 'added' | 'overwritten' | 'skipped';

export interface RestoreLine {
  national_id: string;
  full_name: string;
  outcome: RestoreOutcome;
  reason?: string;
}

export interface RestoreResult {
  added: number;
  overwritten: number;
  skipped: number;
  accounts: RestoreLine[];
}

export function listSuperadmins(): Promise<SuperadminAccount[]> {
  return apiFetch('/superadmin/accounts');
}

/**
 * Download the backup file.
 *
 * NOT `apiFetch`: that parses JSON and unwraps the response envelope, and this
 * response is a file — the same bytes `scripts/superadmin-restore.mjs` reads.
 * Unwrapping it here and re-serialising would produce something that looks
 * right and the script would refuse.
 */
export async function downloadSuperadminBackup(): Promise<void> {
  const lang = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LANG) || 'ar' : 'ar';
  const token = getToken();

  const res = await fetch(`${env.apiUrl}/superadmin/backup`, {
    headers: {
      'Accept-Language': lang,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      /* not JSON — keep the status */
    }
    throw new Error(message);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(await res.blob(), `superadmin-backup-${stamp}.json`);
}

export function restoreSuperadmins(file: JsonValue, overwrite: boolean): Promise<RestoreResult> {
  return apiFetch('/superadmin/restore', {
    method: 'POST',
    body: { file, overwrite },
  });
}
