import { useAuth } from './auth/AuthContext';
import { effectivePermissions, type AdminPage, type Op } from './permissions';

/** Access checks for the signed-in admin. Superadmin passes everything.
 *  Pass the current page so `canOp` checks that page's granted operations;
 *  `canOp` also accepts an explicit page for cross-page checks. */
export function usePermissions(page?: AdminPage) {
  const { role, profile } = useAuth();
  const eff = effectivePermissions(role, profile?.permissions);
  return {
    superadmin: eff.superadmin,
    canPage: (p: AdminPage) => eff.superadmin || eff.pages.has(p),
    canOp: (o: Op, p: AdminPage | undefined = page) =>
      eff.superadmin || (!!p && eff.opsFor(p).has(o)),
  };
}
