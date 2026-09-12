// Per-admin privileges: which pages an admin can open and which operations
// (create/edit/delete/export) they can perform WITHIN EACH page. Superadmin
// bypasses everything.
import type { Role } from './types';

/**
 * Pages a superadmin can grant to an admin — ALL of them.
 *
 * Nothing is reserved. A superadmin holds every page by role; an admin holds
 * exactly what was granted, and any page may be, the admins page and the
 * backup page included. What an admin so granted may do there is still
 * bounded per target on the server (other admins only, never a superadmin,
 * never themselves), and two acts stay with the superadmin role whatever is
 * granted: creating or restoring a superadmin, and the master password.
 *
 * `qr` is a page in its own right: minting a location-bypass QR lets a member
 * check in from anywhere, so it is granted deliberately, not implied.
 */
export const GRANTABLE_PAGES = [
  'dashboard',
  'groups',
  'branches',
  'members',
  'rosters',
  'review',
  'audit',
  'presence',
  'faceTest',
  'faceImages',
  'memberLookup',
  'qr',
  'shifts',
  'departments',
  'settings',
  'admins',
  'backup',
] as const;

/** None any more — kept so the two lists still read as one vocabulary. */
export const SUPERADMIN_PAGES = [] as const;

export type GrantablePage = (typeof GRANTABLE_PAGES)[number];
export type AdminPage = GrantablePage | (typeof SUPERADMIN_PAGES)[number];

export const OPS = ['create', 'edit', 'delete', 'export'] as const;
export type Op = (typeof OPS)[number];

/**
 * The operations that actually exist on each page — drives both the grant UI
 * and the checks (e.g. the dashboard only has "export", not "delete").
 *
 * Mirrors PAGE_OPS in server/src/config/constants.ts, where the same table
 * decides whether a request is honoured; permissions.test.ts compares them.
 */
export const PAGE_OPS: Record<GrantablePage, Op[]> = {
  dashboard: ['export'],
  groups: ['create', 'edit', 'delete'],
  branches: ['create', 'edit', 'delete'],
  members: ['create', 'edit', 'delete', 'export'],
  rosters: ['edit', 'export'],
  review: ['edit', 'export'],
  // Read-only by nature: the trail is written by the server and nothing may
  // edit or delete a row through the UI.
  audit: ['export'],
  presence: ['create', 'edit', 'delete', 'export'],
  faceTest: [],
  // Read-only: there is nothing to create, edit or delete here.
  memberLookup: [],
  faceImages: ['export', 'delete'],
  qr: ['create'],
  shifts: ['create', 'edit', 'delete'],
  departments: ['create', 'edit', 'delete'],
  settings: ['edit'],
  admins: ['create', 'edit', 'delete'],
  // Restore is not an operation here: it creates superadmins, and only a
  // superadmin does that.
  backup: ['export'],
};

export interface Permissions {
  pages: AdminPage[];
  ops?: Op[]; // granted on every page the admin has
  pageOps?: Partial<Record<AdminPage, Op[]>>; // granted per page; wins over `ops`
}

/**
 * What an admin has until a superadmin grants something: NOTHING.
 *
 * This used to be every grantable page with every operation, which made a
 * freshly created admin a near-superadmin until somebody remembered to open
 * the editor. Now a new admin sees an empty menu and the superadmin adds what
 * they should have — and the server (PermissionsGuard) reads a missing grant
 * the same way, so this is not a cosmetic default.
 */
export const DEFAULT_ADMIN_PERMISSIONS: Permissions = {
  pages: [],
};

export interface EffectivePermissions {
  superadmin: boolean;
  pages: Set<AdminPage>;
  opsFor: (page: AdminPage) => Set<Op>;
}

export function effectivePermissions(
  role: Role | null,
  permissions: Permissions | null | undefined,
): EffectivePermissions {
  if (role === 'superadmin') {
    return {
      superadmin: true,
      pages: new Set<AdminPage>([...GRANTABLE_PAGES, ...SUPERADMIN_PAGES]),
      opsFor: () => new Set<Op>(OPS),
    };
  }
  const p = permissions ?? DEFAULT_ADMIN_PERMISSIONS;
  const globalOps = new Set<Op>(p.ops ?? []);
  return {
    superadmin: false,
    pages: new Set<AdminPage>(p.pages ?? []),
    opsFor: (page) => {
      const supported = (PAGE_OPS as Record<string, Op[]>)[page] ?? [...OPS];
      // Prefer explicit per-page config; else fall back to legacy global ops.
      const chosen = p.pageOps?.[page] ?? supported.filter((o) => globalOps.has(o));
      return new Set<Op>(chosen.filter((o) => supported.includes(o)));
    },
  };
}
