// Which credential opens which account.
//
// This used to live in two places at once: the client ran a three-step chain
// (try member-login, fall back to GoTrue, fall back to master-login) and the
// database ran verify_member_login() and verify_master_password() beneath it.
// Neither half could see the other, so "the master password must not open a
// superadmin" was enforced only by the order the client happened to try things
// in — and a caller talking to the Edge Functions directly skipped it.
//
// It is one rule, so it is written once, here, with no database and no bcrypt
// in sight: the caller does the hashing and passes in two booleans.
import { masterPasswordMayOpen, Role } from './role.js';

export type LoginOutcome =
  /** The account's own password. */
  | 'own'
  /** The admin-configured master password, on an account it may open. */
  | 'master'
  /** Neither matched. */
  | 'refused'
  /** The master password matched, but the target is a superadmin. */
  | 'forbidden';

/**
 * Precedence: the account's own password always wins, so a member who has set
 * one is never told that some other secret also works. The master password is
 * only ever consulted after that fails.
 *
 * `forbidden` is deliberately distinct from `refused`. A superadmin whose own
 * password was wrong gets `refused`; one where the MASTER password was offered
 * gets `forbidden`, because that is a different event and worth telling apart
 * when reading the audit log.
 */
export function resolveLogin(role: Role, ownOk: boolean, masterOk: boolean): LoginOutcome {
  if (ownOk) return 'own';
  if (!masterOk) return 'refused';
  return masterPasswordMayOpen(role) ? 'master' : 'forbidden';
}

/**
 * The password of an account that has never set one, or null if it has.
 *
 * A member is created from a roster upload with no password at all, and signs
 * in the first time with their national ID. That was the `password_hash is
 * null` branch of verify_member_login(): a plain string comparison, not a hash.
 *
 * Staff have no such branch. GoTrue minted a hash when the account was created,
 * so a staff row with no hash is a broken row, not a new one — and letting it
 * fall through to "national ID works" would turn a data problem into a way in.
 */
export function initialPassword(account: {
  role: Role;
  nationalId: string;
  passwordHash: string | null;
}): string | null {
  if (account.passwordHash) return null;
  return account.role === Role.MEMBER ? account.nationalId : null;
}
