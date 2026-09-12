import { SetMetadata } from '@nestjs/common';
export const PAGE_KEY = 'page';
export const ANY_STAFF_KEY = 'anyStaff';
/**
 * The page an ADMIN needs to have been granted to call this route, and — for
 * anything that changes data — the operation on it.
 *
 *   @Page('members')                    may open the members page
 *   @Page('members', 'delete')          and may delete there
 *   @Page(['branches', 'groups'])       either page will do (a shared lookup)
 *   @Page('departments', ['create', 'edit'])   an upsert
 *
 * Superadmins are never asked; members are governed by @Roles, not by this.
 * Read by PermissionsGuard; enforced as present by routes.spec.ts.
 */
export const Page = (pages, op) => SetMetadata(PAGE_KEY, { pages, op });
/**
 * Any signed-in admin may call this, whatever they have been granted.
 *
 * For the routes every admin screen needs regardless of which screens they
 * hold — the option lists behind every filter, their own profile, the clock.
 * Saying so is required: an admin-reachable route with neither this nor @Page
 * is refused to admins, and routes.spec.ts fails the build over it.
 */
export const AnyStaff = () => SetMetadata(ANY_STAFF_KEY, true);
//# sourceMappingURL=page.decorator.js.map