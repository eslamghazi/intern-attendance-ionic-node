// Authentication as a use case: owns the transaction, calls the domain for
// every decision, and calls the data layer for every read and write.
//
// WHAT MOVED HERE, AND WHY IT WAS EVER IN SQL
//
// Six SECURITY DEFINER functions used to do this work — verify_member_login,
// change_member_password, set_member_password, verify_master_password,
// set_master_password, master_password_is_set. They were in the database for
// one reason: the CLIENT talked to Postgres directly, so the only place a
// password could be checked without shipping the hash to a browser was inside
// the database. With an API in between, that constraint is gone.
//
// What it cost while it lasted:
//   * the rules were split across plpgsql, an Edge Function and the client,
//     and the "master password must not open a superadmin" rule was enforced
//     by the ORDER THE CLIENT TRIED THINGS IN;
//   * every one of them was untestable without a live Postgres;
//   * pgcrypto's crypt() had to be reachable from two different schemas
//     depending on whether the database was fresh or restored from the dump,
//     which is why db/prelude.sql still carries extensions.crypt() wrappers.
//
// Now: bcryptjs here, the precedence rule in domain/identity/credentials.ts
// with unit tests, and nothing about passwords left in SQL.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { asService } from '../db/context.js';
import type { DbContext } from '../db/context.js';
import * as data from '../data/credentials.js';
import * as tokens from '../data/refreshTokens.js';
import type { Account } from '../data/credentials.js';
import { classifyRefresh, expiresInSeconds, expiryFrom } from '../domain/auth/refresh.js';
import { initialPassword, resolveLogin } from '../domain/identity/credentials.js';
import {
  mayDeleteStaff,
  mayResetPasswordOf,
  mayChangePasswordWithoutCurrent,
  type Caller,
  type Role,
} from '../domain/identity/role.js';
import { parseNationalId } from '../domain/identity/nationalId.js';
import { signProfileJwt } from '../auth/jwt.js';
import { env } from '../env.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../http/errors.js';

/**
 * GoTrue's cost, kept deliberately.
 *
 * Every staff hash carried over from the old project was written at 10, and
 * pgcrypto wrote the member ones at its own default of 6. Hashing new passwords
 * at a THIRD cost would make an account's vintage readable from how long a
 * failed login takes. bcryptjs verifies $2a, $2b and $2y at any cost, so old
 * hashes keep working untouched and new ones all land on the same number.
 */
const BCRYPT_COST = 10;

export interface LoginResult {
  access_token: string;
  refresh_token: string;
  /** Seconds until access_token stops working, so the client can pre-empt it. */
  expires_in: number;
  token_type: 'Bearer';
  role: Role;
  must_change_password: boolean;
  profile: { id: string; full_name: string };
}

/* ------------------------------------------------------------ refresh tokens */

/**
 * 32 bytes from the CSPRNG. Not a JWT: there is nothing to read in it, and it
 * is worthless without the row in the database that matches it — which is what
 * makes it revocable, and a JWT not.
 */
function mintRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256, deliberately not bcrypt.
 *
 * bcrypt is slow so a guessable password cannot be brute-forced. There is no
 * password here — the token is 256 bits of randomness, and no amount of hashing
 * makes that guessable or fails to. What a slow hash WOULD do is put a KDF on
 * the hot path of every renewal by every phone in the faculty.
 */
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Issue an access/refresh pair and record the refresh half. */
async function issuePair(
  tx: DbContext,
  account: { id: string; nationalId: string; role: Role },
  familyId: string,
  userAgent: string | null,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const refreshToken = mintRefreshToken();
  await tokens.insert(tx, {
    profileId: account.id,
    familyId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: expiryFrom(new Date(), env.REFRESH_TOKEN_TTL_DAYS),
    userAgent: userAgent ? userAgent.slice(0, 200) : null,
  });
  return {
    accessToken: signProfileJwt(account.id, account.nationalId, account.role),
    refreshToken,
    expiresIn: expiresInSeconds(env.ACCESS_TOKEN_TTL_MINUTES),
  };
}

/**
 * Does this password open this account?
 *
 * Two ways in: the stored hash, or — for a member who has never set a password
 * — their national ID. The second is a plain comparison because there is no
 * hash to compare against yet; see initialPassword() for why staff get no such
 * path.
 */
async function passwordOpens(account: Account, password: string): Promise<boolean> {
  const initial = initialPassword(account);
  if (initial !== null) return password === initial;
  if (!account.passwordHash) return false;
  return bcrypt.compare(password, account.passwordHash);
}

async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/** The date-of-birth default, or an explicit override. */
function defaultPassword(account: Account, override?: string): string {
  const password = override || parseNationalId(account.nationalId).dobPassword;
  if (!password) throw badRequest('cannot_derive_password', 'cannot derive a password');
  return password;
}

/* -------------------------------------------------------------- signing in */

/**
 * Carries the fact that a master password was aimed at a superadmin out of the
 * transaction, so the audit row can be written by something that commits.
 */
class MasterPasswordRefused extends Error {
  constructor(readonly profileId: string, readonly role: Role) {
    super('forbidden');
  }
}

export async function login(
  nationalId: string,
  password: string,
  userAgent: string | null = null,
): Promise<LoginResult> {
  try {
    return await loginInTransaction(nationalId, password, userAgent);
  } catch (err) {
    if (err instanceof MasterPasswordRefused) {
      await asService((tx) =>
        data.audit(tx, err.profileId, 'master_login', { role: err.role, refused: true }),
      );
      throw forbidden('forbidden');
    }
    throw err;
  }
}

async function loginInTransaction(
  nationalId: string,
  password: string,
  userAgent: string | null,
): Promise<LoginResult> {
  return asService(async (tx) => {
    const account = await data.findByNationalId(tx, nationalId);
    // "No such account" and "wrong password" stay distinguishable: the client
    // shows different copy for each, and collapsing them would be a wire
    // change, not just a security improvement. It does mean this endpoint
    // confirms whether a national ID is enrolled — see the note in README.
    if (!account || !account.isActive) throw notFound('not_found');

    const ownOk = await passwordOpens(account, password);
    // Only reached when the account's own password failed, so a normal sign-in
    // costs one bcrypt rather than two.
    const masterOk = ownOk ? false : await verifyMaster(tx, password);

    const verdict = resolveLogin(account.role, ownOk, masterOk);
    if (verdict === 'refused') throw unauthorized('invalid_credentials');
    if (verdict === 'forbidden') {
      // The master password was correct but aimed at a superadmin. Worth seeing
      // in the log — so it is recorded OUTSIDE this transaction, by the caller
      // below. Writing it here and then throwing would roll the record back
      // along with everything else, and the one event most worth keeping would
      // be the one that never appeared.
      throw new MasterPasswordRefused(account.id, account.role);
    }
    if (verdict === 'master') {
      await data.audit(tx, account.id, 'master_login', { role: account.role });
    }

    // A fresh family per sign-in: revoking one device must not sign out the
    // others, and reuse detected on a phone must not kill a desktop session.
    const pair = await issuePair(tx, account, randomUUID(), userAgent);
    return {
      access_token: pair.accessToken,
      refresh_token: pair.refreshToken,
      expires_in: pair.expiresIn,
      token_type: 'Bearer' as const,
      role: account.role,
      must_change_password: account.mustChangePassword,
      profile: { id: account.id, full_name: account.fullName },
    };
  });
}

/**
 * Exchange a refresh token for a new pair.
 *
 * Always the same 401 on failure, whatever the reason. Telling "expired" apart
 * from "never seen this" from "that family was revoked because someone replayed
 * a token" hands an attacker a probe; the client only needs to know it must
 * sign in again.
 */
/**
 * What a failed renewal still has to WRITE.
 *
 * Revoking a family and recording a replay are the whole value of detecting
 * reuse, and both are writes — but the request also has to fail. Doing them
 * inside the transaction and then throwing rolls them straight back: the reply
 * is a 401 and the stolen family stays live, which is worse than not checking
 * at all, because it looks like it worked.
 *
 * So the transaction DECIDES and this describes what to do about it; the
 * writing happens in a second transaction that is allowed to commit.
 */
interface RefreshRefusal {
  revokeFamilyId: string | null;
  auditProfileId: string | null;
}

export async function refresh(presented: string, userAgent: string | null): Promise<LoginResult> {
  const outcome = await asService<{ ok: true; value: LoginResult } | { ok: false; refusal: RefreshRefusal }>(
    async (tx) => {
      const stored = await tokens.findByHash(tx, hashRefreshToken(presented));
      const verdict = classifyRefresh(stored, new Date());

      if (verdict.kind === 'reuse') {
        // An already-exchanged token is being presented again. The holder
        // cannot do that by accident, so a copy exists — end every session
        // descended from that sign-in and make both parties authenticate.
        return {
          ok: false,
          refusal: {
            revokeFamilyId: verdict.familyId,
            auditProfileId: stored ? stored.profileId : null,
          },
        };
      }
      if (verdict.kind === 'reject' || !stored) {
        return { ok: false, refusal: { revokeFamilyId: null, auditProfileId: null } };
      }

      // Conditional, and the row count decides: two renewals racing with the
      // same token would otherwise both issue a family. The loser is a second
      // use, which is exactly what it looks like from here.
      if (!(await tokens.markRotated(tx, stored.id))) {
        return {
          ok: false,
          refusal: { revokeFamilyId: stored.familyId, auditProfileId: null },
        };
      }

      const account = await data.findById(tx, stored.profileId);
      // Deactivated or deleted since the token was issued. This is the check a
      // 30-day JWT could not make: it stayed valid until it expired.
      if (!account || !account.isActive) {
        return {
          ok: false,
          refusal: { revokeFamilyId: stored.familyId, auditProfileId: null },
        };
      }

      const pair = await issuePair(tx, account, stored.familyId, userAgent);
      return {
        ok: true,
        value: {
          access_token: pair.accessToken,
          refresh_token: pair.refreshToken,
          expires_in: pair.expiresIn,
          token_type: 'Bearer' as const,
          role: account.role,
          must_change_password: account.mustChangePassword,
          profile: { id: account.id, full_name: account.fullName },
        },
      };
    },
  );

  if (outcome.ok) return outcome.value;

  const { revokeFamilyId, auditProfileId } = outcome.refusal;
  if (revokeFamilyId) {
    await asService(async (tx) => {
      await tokens.revokeFamily(tx, revokeFamilyId);
      if (auditProfileId) {
        await data.audit(tx, auditProfileId, 'login', {
          event: 'refresh_token_reuse',
          family: revokeFamilyId,
        });
      }
    });
  }
  // Always the same answer, whatever the reason. Telling "expired" apart from
  // "never seen this" from "that family was revoked" hands an attacker a probe;
  // the client only needs to know it must sign in again.
  throw unauthorized('invalid_refresh_token');
}

/**
 * Sign out. Revokes the whole family, not just the token presented, so the
 * access token's remaining minutes are the only thing that outlives it.
 *
 * Never fails: a client signing out has already discarded its copy, and an
 * error here would strand the app on the screen it is trying to leave.
 */
export async function logout(presented: string | null): Promise<void> {
  if (!presented) return;
  return asService(async (tx) => {
    const stored = await tokens.findByHash(tx, hashRefreshToken(presented));
    if (stored) await tokens.revokeFamily(tx, stored.familyId);
  });
}

/** Sign out everywhere — a lost phone. Revokes every family for the caller. */
export async function logoutEverywhere(caller: Caller): Promise<{ revoked: number }> {
  return asService(async (tx) => ({
    revoked: await tokens.revokeAllForProfile(tx, caller.id),
  }));
}

/* ------------------------------------------------------------- own password */

/** Change your own password, proving the current one first. */
export async function changeOwnPassword(
  caller: Caller,
  current: string,
  next: string,
  userAgent: string | null = null,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  return asService(async (tx) => {
    const account = await data.findById(tx, caller.id);
    if (!account) throw notFound();
    if (!(await passwordOpens(account, current))) throw unauthorized('wrong_current');
    await data.storePasswordHash(tx, account.id, await hash(next), false);

    // Everything issued under the old password stops working. Someone changing
    // their password because they think it is known is doing exactly this, and
    // before there was a token table it was impossible: the 30-day JWT outlived
    // the password it was issued for.
    await tokens.revokeAllForProfile(tx, account.id);

    // Including the caller's own — so they get a new pair rather than being
    // signed out by the act of securing their account.
    const pair = await issuePair(tx, account, randomUUID(), userAgent);
    return {
      access_token: pair.accessToken,
      refresh_token: pair.refreshToken,
      expires_in: pair.expiresIn,
    };
  });
}

/**
 * The forced first change: set a password without proving the old one.
 *
 * Gated on must_change_password, the one state where the user provably has no
 * password of their own yet. GoTrue's updateUser() allowed this for any
 * signed-in session, which meant a borrowed unlocked phone could take over an
 * account silently.
 */
export async function setInitialPassword(
  caller: Caller,
  next: string,
  userAgent: string | null = null,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  return asService(async (tx) => {
    const account = await data.findById(tx, caller.id);
    if (!account) throw notFound();
    if (!mayChangePasswordWithoutCurrent(account.mustChangePassword)) {
      throw forbidden('use /auth/password: this account already has a password');
    }
    await data.storePasswordHash(tx, account.id, await hash(next), false);

    // The old password here was one an admin read out, or the national ID —
    // both known to someone else. Anything signed in with it goes.
    await tokens.revokeAllForProfile(tx, account.id);
    const pair = await issuePair(tx, account, randomUUID(), userAgent);
    return {
      access_token: pair.accessToken,
      refresh_token: pair.refreshToken,
      expires_in: pair.expiresIn,
    };
  });
}

/* --------------------------------------------------------- admin-side reset */

/**
 * Reset someone else's password, back to their date of birth unless told
 * otherwise. Returns the new password so the admin can read it out.
 *
 * The Edge Function this replaces called GoTrue's updateUserById() for members
 * too — but members never had an auth.users row, so resetting a member's
 * password could not ever have worked. It works now.
 */
export async function resetPassword(
  actor: Caller,
  target: { profileId?: string; nationalId?: string; expect?: 'member' | 'staff'; password?: string },
): Promise<{ password: string }> {
  return asService(async (tx) => {
    const account = target.profileId
      ? await data.findById(tx, target.profileId)
      : await data.findByNationalId(tx, target.nationalId!);
    if (!account) throw notFound();

    if (target.expect === 'member' && account.role !== 'member') {
      throw badRequest('not_a_member', 'not a member');
    }
    if (target.expect === 'staff' && account.role === 'member') {
      throw badRequest('not_staff', 'not a staff account');
    }
    if (!mayResetPasswordOf(actor.role, account.role)) throw forbidden();

    const password = defaultPassword(account, target.password);
    // must_change_password: whoever performed the reset now knows this
    // password, so it has to be replaced at the next sign-in.
    await data.storePasswordHash(tx, account.id, await hash(password), true);

    // And every session opened with the old one ends. A reset is what an admin
    // does when an account is in the wrong hands; leaving the existing sessions
    // running would make it a formality.
    await tokens.revokeAllForProfile(tx, account.id);
    await data.audit(tx, actor.id, 'password_changed', {
      reset_for: account.id,
      by: actor.id,
    });
    return { password };
  });
}

/* ----------------------------------------------------------- staff accounts */

export interface NewStaff {
  national_id: string;
  full_name: string;
  phone?: string | null;
  password?: string;
  role: 'admin';
  assignments: { group_id?: string | null; branch_id?: string | null }[];
}

export async function createStaff(
  actor: Caller,
  input: NewStaff,
): Promise<{ id: string; password: string }> {
  const parsed = parseNationalId(input.national_id);
  if (!parsed.valid) throw badRequest('invalid_national_id', 'invalid national id');
  const password = input.password || parsed.dobPassword!;
  const passwordHash = await hash(password);

  const id = await asService(async (tx) => {
    if (await data.findByNationalId(tx, input.national_id)) {
      throw conflict('duplicate', 'national id already in use');
    }

    // One INSERT. This used to be two tables in two systems — GoTrue minted the
    // auth user over HTTP and the Edge Function then wrote the profile, so a
    // failure in between left an orphan auth user that nothing cleaned up.
    const profileId = randomUUID();
    await tx.execute(sql`
      insert into public.profiles (id, role, full_name, national_id, phone,
                                   password_hash, must_change_password, created_by)
      values (${profileId}, ${input.role}::public.role, ${input.full_name},
              ${input.national_id}, ${input.phone ?? null}, ${passwordHash}, true, ${actor.id})
    `);

    for (const a of input.assignments.filter((x) => x.group_id || x.branch_id)) {
      await tx.execute(sql`
        insert into public.admin_assignments (admin_id, group_id, branch_id)
        values (${profileId}, ${a.group_id ?? null}, ${a.branch_id ?? null})
      `);
    }
    return profileId;
  });

  return { id, password };
}

export async function deleteStaff(actor: Caller, id: string): Promise<void> {
  return asService(async (tx) => {
    const account = await data.findById(tx, id);
    if (!account) throw notFound();
    if (actor.id === id) throw badRequest('cannot_delete_self', 'cannot delete yourself');
    if (!mayDeleteStaff(actor, id, account.role)) {
      throw forbidden('only admin accounts can be deleted');
    }

    // admin_assignments cascade from profiles, and profiles.created_by is ON
    // DELETE SET NULL — so an admin who once created accounts can be removed.
    // While created_by pointed at auth.users with no delete rule, this failed
    // with a foreign key violation for exactly those admins.
    await tx.execute(sql`delete from public.profiles where id = ${id}`);
    await data.audit(tx, actor.id, 'staff_deleted', { profile_id: id });
  });
}

/* ------------------------------------------------------------ master password */

async function verifyMaster(tx: DbContext, password: string): Promise<boolean> {
  const stored = await data.readMasterPasswordHash(tx);
  if (!stored || !password) return false;
  return bcrypt.compare(password, stored);
}

export async function masterPasswordIsSet(): Promise<boolean> {
  return asService(async (tx) => (await data.readMasterPasswordHash(tx)) !== null);
}

/** Set it, or clear it with an empty string. */
export async function setMasterPassword(password: string): Promise<void> {
  const stored = password === '' ? null : await hash(password);
  return asService((tx) => data.writeMasterPasswordHash(tx, stored));
}
