// What an admin's grant lets them do.
//
// This is the server's half of ClientApp/src/lib/permissions.ts. The client
// uses the same rules to decide which buttons to draw; this file is what decides
// whether the request behind the button is honoured. The two must agree, and
// the shape of a grant is deliberately simple enough that they can:
//
//   pages     the pages the admin may OPEN — reading is implied
//   pageOps   per page, which of create/edit/delete/export they may do
//   ops       the older, page-wide form; used only where pageOps says nothing
//
// A grant that is null — an admin nobody has configured yet — allows NOTHING.
// It used to mean "everything a superadmin can grant", which turned every new
// admin into a near-superadmin until somebody remembered to open the editor.
import { PAGE_OPS } from '../../config/constants.js';
import type { AdminOp, AdminPage, AdminPermissions } from './types.js';

/** A page name, or the first of several that would each satisfy a route. */
export type PageRequirement = AdminPage | readonly AdminPage[];

/** An operation, or the first of several that would each satisfy a route. */
export type OpRequirement = AdminOp | readonly AdminOp[];

/** The operations a page has at all — a grant cannot allow what does not exist. */
export function opsOnPage(page: AdminPage): readonly AdminOp[] {
  return PAGE_OPS[page];
}

/** The pages an admin may open. */
export function grantedPages(grant: AdminPermissions | null | undefined): ReadonlySet<AdminPage> {
  return new Set<AdminPage>(grant?.pages ?? []);
}

/**
 * The operations an admin may perform on one page.
 *
 * Empty when the page itself is not granted: an operation on a page you cannot
 * open is not a thing. Per-page grants win over the page-wide list, and both
 * are clipped to what the page actually offers.
 */
export function grantedOps(
  grant: AdminPermissions | null | undefined,
  page: AdminPage,
): ReadonlySet<AdminOp> {
  if (!grantedPages(grant).has(page)) return new Set();
  const supported = opsOnPage(page);
  const chosen = grant?.pageOps?.[page] ?? (grant?.ops ?? []).filter((o) => supported.includes(o));
  return new Set(chosen.filter((o) => supported.includes(o)));
}

const asList = <T>(one: T | readonly T[]): readonly T[] => (Array.isArray(one) ? one : [one as T]);

/**
 * Does this grant satisfy a route's requirement?
 *
 * A route names the page it belongs to and, for anything that changes data,
 * the operation. Either may be a list, read as "any of these": a lookup that
 * two pages share is satisfied by holding either page, and an upsert is
 * satisfied by `create` or `edit`.
 */
export function grantAllows(
  grant: AdminPermissions | null | undefined,
  pages: PageRequirement,
  op?: OpRequirement,
): boolean {
  const ownedPages = grantedPages(grant);
  const candidates = asList(pages).filter((p) => ownedPages.has(p));
  if (!candidates.length) return false;
  if (!op) return true;
  const wanted = asList(op);
  return candidates.some((page) => {
    const allowed = grantedOps(grant, page);
    return wanted.some((o) => allowed.has(o));
  });
}
