// Data access for accounts and their passwords. Takes an OPEN transaction.
//
// ONE password store. Until this port there were two: members' bcrypt hashes in
// profiles.password_hash, staff's in auth.users.encrypted_password, because
// GoTrue owned the second table and could not be taught about the first. Both
// held the same format, so nothing was gained by the split except two code
// paths for every password operation and a table that existed only to hold one
// column. auth.users is gone; profiles.password_hash is the store.
import { sql } from 'drizzle-orm';
import type { DbContext } from '../db/context.js';
import { query } from '../db/context.js';
import type { Role } from '../domain/identity/role.js';

/** An account as the credential rules need to see it. */
export interface Account {
  id: string;
  role: Role;
  fullName: string;
  nationalId: string;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordHash: string | null;
}

interface AccountRow {
  id: string;
  role: Role;
  full_name: string;
  national_id: string;
  is_active: boolean | null;
  must_change_password: boolean | null;
  password_hash: string | null;
}

const toAccount = (r: AccountRow): Account => ({
  id: r.id,
  role: r.role,
  fullName: r.full_name,
  nationalId: r.national_id,
  // Both columns are NOT NULL in the model; the coalesce is for a row that
  // predates the constraint in a restored database.
  isActive: r.is_active ?? true,
  mustChangePassword: r.must_change_password ?? false,
  passwordHash: r.password_hash,
});

const COLUMNS = sql`id, role, full_name, national_id, is_active, must_change_password, password_hash`;

export async function findByNationalId(tx: DbContext, nationalId: string): Promise<Account | null> {
  const rows = await query<AccountRow>(
    tx,
    sql`select ${COLUMNS} from public.profiles where national_id = ${nationalId} limit 1`,
  );
  return rows[0] ? toAccount(rows[0]) : null;
}

export async function findById(tx: DbContext, id: string): Promise<Account | null> {
  const rows = await query<AccountRow>(
    tx,
    sql`select ${COLUMNS} from public.profiles where id = ${id} limit 1`,
  );
  return rows[0] ? toAccount(rows[0]) : null;
}

/**
 * Store a hash. `mustChangePassword` is set in the same statement rather than a
 * second UPDATE: an admin reset that wrote the hash but not the flag would hand
 * out a known password the user is never prompted to replace.
 */
export async function storePasswordHash(
  tx: DbContext,
  profileId: string,
  hash: string,
  mustChangePassword: boolean,
): Promise<number> {
  const result = await tx.execute(sql`
    update public.profiles
       set password_hash = ${hash}, must_change_password = ${mustChangePassword}
     where id = ${profileId}
  `);
  return result.rowCount ?? 0;
}

export async function readMasterPasswordHash(tx: DbContext): Promise<string | null> {
  const rows = await query<{ master_password_hash: string | null }>(
    tx,
    sql`select master_password_hash from public.app_settings where id = 1`,
  );
  // Cleared is stored as '' by some of the old client paths and as null by
  // others; both mean "not configured".
  return rows[0]?.master_password_hash || null;
}

export async function writeMasterPasswordHash(
  tx: DbContext,
  hash: string | null,
): Promise<void> {
  await tx.execute(sql`
    update public.app_settings set master_password_hash = ${hash} where id = 1
  `);
}

/**
 * Best-effort audit. An audit write must never fail the operation it records —
 * that is how the Edge Functions had it, and a login that 500s because the log
 * table is full is worse than a missing log line.
 */
export async function audit(
  tx: DbContext,
  actorId: string,
  event: string,
  detail: unknown,
): Promise<void> {
  try {
    await tx.execute(sql`
      insert into public.audit_log (actor_id, event, detail)
      values (${actorId}, ${event}, ${JSON.stringify(detail)}::jsonb)
    `);
  } catch {
    /* ignore */
  }
}
