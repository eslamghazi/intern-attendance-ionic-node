// Who somebody is, and how they proved it.

import type { ADMIN_OPS, ADMIN_PAGES } from '../../config/constants.js';
import type { Role } from './role.js';

/** The signed-in person, as every handler sees them. */
export interface Caller {
  id: string;
  role: Role;
  nationalId?: string;
}

// Egyptian national-ID parsing. Ported verbatim from the code that used to own
// it — the derived date-of-birth password is the default credential for every
// new account, so any change here silently locks people out.
export interface ParsedNationalId {
  valid: boolean;
  /** ddmmyyyy — the default password for a freshly created account. */
  dobPassword?: string;
}

export type LoginOutcome =
  /** The account's own password. */
  | 'own'
  /** The admin-configured master password, on an account it may open. */
  | 'master'
  /** Neither matched. */
  | 'refused'
  /** The master password matched, but the target is a superadmin. */
  | 'forbidden';

// --- What an admin may do ----------------------------------------------------
//
// A grant, not an enforcement: the server's own gates are the role guard and the
// assignment scope. This decides which pages an admin is offered and which
// buttons appear on them, and it is stored on the profile as jsonb.

/** A page an admin can be granted. */
export type AdminPage = (typeof ADMIN_PAGES)[number];

/** An operation a grant can allow. */
export type AdminOp = (typeof ADMIN_OPS)[number];

export interface AdminPermissions {
  /** The pages this admin may open. */
  pages: AdminPage[];
  /** Allowed on every granted page. */
  ops?: AdminOp[];
  /** Allowed on one page specifically; beats `ops`. */
  pageOps?: Partial<Record<AdminPage, AdminOp[]>>;
}

// --- Seeding the first superadmin --------------------------------------------

/**
 * What an environment says to do about the first superadmin.
 *
 * `refuse` carries the reason because a boot that stops with it is shorter than
 * working out why an account nobody can sign in as was or was not created.
 */
export type SeedVerdict =
  | { kind: 'skip' }
  | { kind: 'seed' }
  | { kind: 'refuse'; why: string };
