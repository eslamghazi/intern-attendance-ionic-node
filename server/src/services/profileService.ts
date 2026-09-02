// What a signed-in person may change about themselves.
//
// Three SECURITY DEFINER functions used to do this — mark_enrolled,
// mark_password_changed and update_my_profile — each ending in
// `where id = auth.uid()`. They had to be definers: there is no policy anywhere
// letting a member update their own profiles or members row, so a plain UPDATE
// from the client was refused, and the only way through was a function that
// stepped around RLS and rewrote the `where` clause itself.
//
// The API knows who is asking, so the id is a parameter and the definer trick
// is unnecessary. These still run as the service role for the same reason the
// functions did — no policy permits the write — but the row is pinned to the
// caller here, in code, rather than inside a function body.
//
// WHAT THE COLUMN LIST IS DOING
//
// The one guarantee that matters is that a member cannot promote themselves.
// The plpgsql version relied on simply not mentioning `role` or `permissions`;
// so does this, except the column list is now visible in the file you are
// reading rather than in a function definition three tools away.
import { sql } from 'drizzle-orm';
import { asService } from '../db/context.js';
import { query } from '../db/context.js';
import { conflict } from '../http/errors.js';
import type { Caller } from '../domain/identity/role.js';

export interface ProfileEdit {
  fullName: string;
  /** '' clears these two. That is the existing contract, not an oversight. */
  phone: string;
  email: string;
  nationalId: string;
  /** null leaves the current one alone. */
  avatarUrl: string | null;
}

/** A member declaring their face enrolment finished. */
export async function markEnrolled(caller: Caller): Promise<void> {
  return asService(async (tx) => {
    await tx.execute(sql`
      update public.members set enrollment_status = 'enrolled'
       where profile_id = ${caller.id}
    `);
  });
}

/** Clears the forced-change flag. Kept for the client's existing flow. */
export async function markPasswordChanged(caller: Caller): Promise<void> {
  return asService(async (tx) => {
    await tx.execute(sql`
      update public.profiles set must_change_password = false where id = ${caller.id}
    `);
  });
}

/**
 * Edit your own profile.
 *
 * The empty-string rules are carried over verbatim, and they differ per column
 * on purpose: a blank name means "leave it", a blank phone or email means
 * "clear it". The client has always sent '' for both cases, so collapsing them
 * would either wipe names or make the fields unclearable.
 */
export async function updateOwnProfile(caller: Caller, edit: ProfileEdit): Promise<void> {
  return asService(async (tx) => {
    if (edit.nationalId) {
      const taken = await query<{ id: string }>(
        tx,
        sql`select id from public.profiles
             where national_id = ${edit.nationalId} and id <> ${caller.id} limit 1`,
      );
      // 409 with the code the client already switches on. As a plpgsql
      // `raise exception` this arrived as an unmapped database error.
      if (taken.length) throw conflict('national_id_taken', 'that national id is already in use');
    }

    await tx.execute(sql`
      update public.profiles set
        full_name   = coalesce(nullif(${edit.fullName}, ''), full_name),
        phone       = nullif(${edit.phone}, ''),
        email       = nullif(${edit.email}, ''),
        national_id = coalesce(nullif(${edit.nationalId}, ''), national_id),
        avatar_url  = coalesce(${edit.avatarUrl}, avatar_url)
      where id = ${caller.id}
    `);
  });
}
