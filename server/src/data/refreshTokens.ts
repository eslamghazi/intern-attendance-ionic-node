// Data access for refresh tokens. Takes an OPEN transaction.
//
// The raw token never reaches this file. Callers hash it first (see
// services/authService.ts) so a database backup, a query log or a stray
// `select *` cannot hand anyone a working session.
import { sql } from 'drizzle-orm';
import type { DbContext } from '../db/context.js';
import { query } from '../db/context.js';
import type { StoredRefreshToken } from '../domain/auth/refresh.js';

export interface StoredToken extends StoredRefreshToken {
  id: string;
}

export async function findByHash(tx: DbContext, tokenHash: string): Promise<StoredToken | null> {
  const rows = await query<{
    id: string;
    profile_id: string;
    family_id: string;
    expires_at: string;
    rotated_at: string | null;
    revoked_at: string | null;
  }>(
    tx,
    sql`select id, profile_id, family_id, expires_at, rotated_at, revoked_at
          from public.refresh_tokens where token_hash = ${tokenHash} limit 1`,
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    profileId: r.profile_id,
    familyId: r.family_id,
    expiresAt: new Date(r.expires_at),
    rotatedAt: r.rotated_at ? new Date(r.rotated_at) : null,
    revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
  };
}

export async function insert(
  tx: DbContext,
  row: {
    profileId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
  },
): Promise<void> {
  await tx.execute(sql`
    insert into public.refresh_tokens
      (profile_id, family_id, token_hash, expires_at, user_agent)
    values (${row.profileId}, ${row.familyId}, ${row.tokenHash},
            ${row.expiresAt.toISOString()}, ${row.userAgent})
  `);
}

/**
 * Mark one token exchanged.
 *
 * Conditional on rotated_at still being null, and the caller checks the row
 * count: two simultaneous renewals with the same token would otherwise both
 * succeed and issue two live families. Losing that race means the second one
 * is treated as what it is — a second use.
 */
export async function markRotated(tx: DbContext, id: string): Promise<boolean> {
  const result = await tx.execute(sql`
    update public.refresh_tokens set rotated_at = now()
     where id = ${id} and rotated_at is null
  `);
  return (result.rowCount ?? 0) === 1;
}

/** Revoke every unrevoked token in a family. Used on logout and on reuse. */
export async function revokeFamily(tx: DbContext, familyId: string): Promise<number> {
  const result = await tx.execute(sql`
    update public.refresh_tokens set revoked_at = now()
     where family_id = ${familyId} and revoked_at is null
  `);
  return result.rowCount ?? 0;
}

/** Revoke everything for one person — a lost phone, or a password reset. */
export async function revokeAllForProfile(tx: DbContext, profileId: string): Promise<number> {
  const result = await tx.execute(sql`
    update public.refresh_tokens set revoked_at = now()
     where profile_id = ${profileId} and revoked_at is null
  `);
  return result.rowCount ?? 0;
}
