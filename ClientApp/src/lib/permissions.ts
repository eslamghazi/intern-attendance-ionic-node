// Per-admin privileges: which pages an admin can open and which operations
// (create/edit/delete/export) they can perform WITHIN EACH page. Superadmin
// bypasses everything.
import type { Role } from './types';

/** Pages a superadmin can grant to an admin. */
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
] as const;

/** Pages only the superadmin ever sees. */
export const SUPERADMIN_PAGES = ['shifts', 'departments', 'admins', 'settings'] as const;

export type GrantablePage = (typeof GRANTABLE_PAGES)[number];
export type AdminPage = GrantablePage | (typeof SUPERADMIN_PAGES)[number];

export const OPS = ['create', 'edit', 'delete', 'export'] as const;
export type Op = (typeof OPS)[number];

/** The operations that actually exist on each page — drives both the grant UI
 *  and the checks (e.g. the dashboard only has "export", not "delete"). */
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
  presence: ['export'],
  faceTest: [],
  faceImages: ['export', 'delete'],
  // Read-only: there is nothing to create, edit or delete here.
  memberLookup: [],
};

export interface Permissions {
  pages: AdminPage[];
  ops?: Op[]; // granted on every page the admin has
  pageOps?: Partial<Record<AdminPage, Op[]>>; // granted per page; wins over `ops`
}

/** Default when an admin has no explicit permissions yet — full base access. */
export const DEFAULT_ADMIN_PERMISSIONS: Permissions = {
  pages: [...GRANTABLE_PAGES],
  ops: [...OPS],
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
