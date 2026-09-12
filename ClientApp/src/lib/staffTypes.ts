// Staff account "types" — مدير، مشرف، مراجع — as presets, not as roles.
//
// The database knows two staff roles and no more: `superadmin`, which holds
// every page and is the only role that can create staff and grant pages, and
// `admin`, which holds exactly the pages it was granted. Nothing else is
// stored about what kind of admin someone is, and nothing should be: a
// "manager" column would be a second source of truth beside the grant, and
// the guard reads the grant.
//
// So a type is a NAME plus a bundle of default grants. Picking one when an
// account is created (or applying one in the editor) fills the grant in; the
// superadmin can then adjust any page or operation. What gets stored is the
// resulting grant, and the type an account shows is worked out by matching
// its grant back against these — an account whose grant fits no preset is
// simply "custom". No column, no migration, no effect on the server.
import { GRANTABLE_PAGES, OPS, PAGE_OPS, type GrantablePage, type Op, type Permissions } from './permissions';
import type { Role } from './types';

export const STAFF_TYPES = ['superadmin', 'manager', 'supervisor', 'reviewer', 'custom'] as const;
export type StaffType = (typeof STAFF_TYPES)[number];

/** What the create form opens on: the everyday staff account. */
export const DEFAULT_STAFF_TYPE: StaffType = 'supervisor';

/** A grant built from `page: ops` pairs; `'*'` means every operation the page has. */
type Preset = Partial<Record<GrantablePage, Op[] | '*'>>;

function grantOf(preset: Preset): Permissions {
  const pages = Object.keys(preset) as GrantablePage[];
  const pageOps: Partial<Record<GrantablePage, Op[]>> = {};
  for (const p of pages) {
    const want = preset[p];
    pageOps[p] = want === '*' ? [...PAGE_OPS[p]] : [...(want ?? [])];
  }
  return { pages, pageOps };
}

/** Every page but the two that manage staff — those a superadmin grants on purpose. */
const ALL_BUT_STAFF: Preset = Object.fromEntries(
  GRANTABLE_PAGES.filter((p) => p !== 'admins' && p !== 'backup').map((p) => [p, '*']),
) as Preset;

/**
 * What each type grants by default.
 *
 *   manager     every page but the two that manage staff, every operation —
 *               a second in command; the admins and backup pages are granted
 *               on purpose, never by a preset
 *   supervisor  runs the day: the dashboard, the roster and its review, who
 *               is present now, lookups and the face tool, and the QR bypass;
 *               reads the members list but does not change it
 *   reviewer    looks and reports, changes nothing: the dashboard, the
 *               attendance review, the audit trail, lookups
 *   custom      nothing pre-filled; the superadmin picks page by page
 */
const PRESETS: Record<Exclude<StaffType, 'superadmin'>, Preset> = {
  manager: ALL_BUT_STAFF,
  supervisor: {
    dashboard: '*',
    members: [],
    rosters: '*',
    review: '*',
    presence: '*',
    memberLookup: [],
    faceTest: [],
    qr: '*',
  },
  reviewer: {
    dashboard: ['export'],
    review: ['export'],
    audit: ['export'],
    memberLookup: [],
  },
  custom: {},
};

/** The role a type is stored as, and the grant it starts with. */
export function staffTypeDefaults(type: StaffType): { role: Extract<Role, 'admin' | 'superadmin'>; permissions: Permissions | null } {
  if (type === 'superadmin') return { role: 'superadmin', permissions: null };
  return { role: 'admin', permissions: grantOf(PRESETS[type]) };
}

/** The same grant written two ways is the same grant. */
function key(p: Permissions | null | undefined): string {
  if (!p) return '';
  const pages = [...(p.pages ?? [])].sort();
  return pages
    .map((page) => {
      const ops = p.pageOps?.[page] ?? (p.ops ?? []).filter((o) => (OPS as readonly Op[]).includes(o));
      return `${page}:${[...ops].sort().join(',')}`;
    })
    .join('|');
}

/**
 * Which type an account IS, read off its role and grant.
 *
 * Exact matches only: a supervisor who was also given the audit page is not a
 * supervisor any more, and saying so is the point — the label never claims
 * more or less than the grant.
 */
export function staffTypeOf(role: Role | null | undefined, permissions: Permissions | null | undefined): StaffType {
  if (role === 'superadmin') return 'superadmin';
  const k = key(permissions);
  for (const type of ['manager', 'supervisor', 'reviewer'] as const) {
    if (key(grantOf(PRESETS[type])) === k) return type;
  }
  return 'custom';
}
