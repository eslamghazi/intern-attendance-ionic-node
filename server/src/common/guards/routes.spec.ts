// Every route must SAY who may call it.
//
// WHY THIS TEST EXISTS
//
// The API is the only thing deciding who may call what — the database enforces
// nothing (see infrastructure/database/context.ts). So a route that forgets to
// declare itself is not "covered by something else"; it is covered by a default.
//
// RolesGuard makes that default SAFE by failing closed, and this test makes it
// VISIBLE by failing the build when a route relies on it. A reviewer then has to
// see a decorator and agree with it, rather than inherit whatever the guard
// happens to do. The two together are why `PATCH /members/:id` — whose writable
// columns include `bypass_face` and `bypass_location` — cannot quietly become
// reachable by the members it governs.
//
// It reads Nest's own metadata rather than grepping for decorators, so a route
// that inherits @Roles from its controller class counts as declared, and a
// commented-out decorator does not.
import 'reflect-metadata';
import { describe, it, expect, beforeAll } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Every *.controller.ts under src/. */
function controllerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...controllerFiles(full));
    else if (entry.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

interface Route {
  file: string;
  handler: string;
  declared: 'public' | 'roles' | 'NOTHING';
  /** An admin may call it — so it must also say which page it belongs to. */
  adminReachable: boolean;
  /** What it says about that: a page grant, any admin, or nothing. */
  page: 'page' | 'anyStaff' | 'NOTHING';
}

const routes: Route[] = [];

beforeAll(async () => {
  // The controllers pull in env.ts, which refuses to load without these. They
  // are never connected to — nothing in this file makes a request.
  process.env.DATABASE_URL ??= 'postgres://nobody:nobody@127.0.0.1:1/none';
  process.env.APP_JWT_SECRET ??= 'x'.repeat(64);
  process.env.MEDIA_SIGNING_SECRET ??= 'y'.repeat(64);

  const { PATH_METADATA } = await import('@nestjs/common/constants.js');
  const { ROLES_KEY } = await import('../decorators/roles.decorator.js');
  const { IS_PUBLIC_KEY } = await import('../decorators/public.decorator.js');
  const { PAGE_KEY, ANY_STAFF_KEY } = await import('../decorators/page.decorator.js');
  const { Role } = await import('../enums/index.js');

  for (const file of controllerFiles(SRC)) {
    const mod: Record<string, unknown> = await import(pathToFileURL(file).href);
    for (const exported of Object.values(mod)) {
      if (typeof exported !== 'function') continue;
      const cls = exported as { prototype: Record<string, unknown>; name: string };
      if (Reflect.getMetadata(PATH_METADATA, cls) === undefined) continue;

      for (const handler of Object.getOwnPropertyNames(cls.prototype)) {
        if (handler === 'constructor') continue;
        const fn = cls.prototype[handler];
        if (typeof fn !== 'function') continue;
        // Only methods carrying a route path are endpoints.
        if (Reflect.getMetadata(PATH_METADATA, fn) === undefined) continue;

        const isPublic =
          Reflect.getMetadata(IS_PUBLIC_KEY, fn) ?? Reflect.getMetadata(IS_PUBLIC_KEY, cls);
        const roles: string[] | undefined =
          Reflect.getMetadata(ROLES_KEY, fn) ?? Reflect.getMetadata(ROLES_KEY, cls);
        const hasPage =
          Reflect.getMetadata(PAGE_KEY, fn) ?? Reflect.getMetadata(PAGE_KEY, cls);
        const anyStaff =
          Reflect.getMetadata(ANY_STAFF_KEY, fn) ?? Reflect.getMetadata(ANY_STAFF_KEY, cls);

        routes.push({
          file: relative(SRC, file).replace(/\\/g, '/'),
          handler: `${cls.name}.${handler}`,
          declared: isPublic ? 'public' : roles?.length ? 'roles' : 'NOTHING',
          adminReachable: !isPublic && (roles?.includes(Role.ADMIN) ?? false),
          page: hasPage ? 'page' : anyStaff ? 'anyStaff' : 'NOTHING',
        });
      }
    }
  }
// 180s, not the 10s default: this imports EVERY controller in the application,
// and through them the xlsx writer the export routes use. Transforming that
// once is slow — over a minute on a loaded machine — and the assertions below
// are instant. A timeout here is never a finding; it only hides the real ones.
}, 180_000);

describe('route authorization is always declared', () => {
  it('finds the controllers at all (guards against a silently empty sweep)', () => {
    expect(routes.length).toBeGreaterThan(100);
  });

  it('every route declares @Public() or @Roles(...)', () => {
    const undeclared = routes
      .filter((r) => r.declared === 'NOTHING')
      .map((r) => `${r.handler}  (${r.file})`);

    expect(
      undeclared,
      `These routes declare no authorization. RolesGuard will fall back to ` +
        `staff-only, which is safe but silent — say so explicitly:\n` +
        `  @Roles(Role.MEMBER, Role.ADMIN, Role.SUPERADMIN)  a member may call it\n` +
        `  @Roles(Role.ADMIN, Role.SUPERADMIN)               staff only\n` +
        `  @Public()                                         no token at all\n\n` +
        undeclared.join('\n'),
    ).toEqual([]);
  });

  it('every route an admin may call names its page, or says any admin will do', () => {
    // The same argument as above, one layer down. RolesGuard decides which
    // KIND of account may call a route; PermissionsGuard decides whether THIS
    // admin was granted the page it belongs to. A route that declares neither
    // @Page nor @AnyStaff is refused to every admin — safe, and silent, which is
    // why it fails here instead.
    const unmapped = routes
      .filter((r) => r.adminReachable && r.page === 'NOTHING')
      .map((r) => `${r.handler}  (${r.file})`);

    expect(
      unmapped,
      `These routes admit admins but say nothing about which page grant they ` +
        `need. PermissionsGuard will refuse them to every admin — say what is meant:\n` +
        `  @Page('members', 'delete')   needs the page, and that operation on it\n` +
        `  @Page('members')             needs the page; reading is implied\n` +
        `  @AnyStaff()                  any admin, whatever they hold\n\n` +
        unmapped.join('\n'),
    ).toEqual([]);
  });

  it('keeps the routes any admin may call small and reviewed', () => {
    // Every entry here is reachable by an admin who has been granted NOTHING.
    // Each one should be something every admin screen needs regardless of
    // which screens they hold — option lists, their own account, the clock.
    const anyStaff = routes.filter((r) => r.page === 'anyStaff').map((r) => r.handler).sort();
    expect(anyStaff).toEqual([
      'AuthController.changePassword',
      'AuthController.logoutAll',
      'AuthController.me',
      'CatalogController.getBranchesOptions',
      'CatalogController.getGroupsOptions',
      'CatalogController.getShifts',
      'CatalogController.getShiftsKeys',
      'DepartmentsController.getDepartmentsOptions',
      'MembersController.getByProfile',
      'MembersController.getCountActive',
      'ProfileController.getMemberCode',
      'ProfileController.markEnrolled',
      'ProfileController.updateMe',
      'ReportsController.exportHistory',
      'ReportsController.getDay',
      'ReportsController.getHistory',
      'RosterController.getMakerData',
      'StorageController.uploadObject',
    ]);
  });

  it('keeps the public surface small and reviewed', () => {
    // Not a correctness check — a tripwire. Every entry here is reachable with
    // NO token, so adding one should be a deliberate, reviewed act.
    const publicRoutes = routes.filter((r) => r.declared === 'public').map((r) => r.handler).sort();
    expect(publicRoutes).toEqual([
      'AuthController.login',
      'AuthController.logout',
      'AuthController.refresh',
      'HealthController.getApiHealth',
      'HealthController.getApiReady',
      'HealthController.getHealth',
      'HealthController.getReady',
      'SettingsController.getBranding',
      'SettingsController.getBrandingLogo',
      'SettingsController.getSettings',
      'StorageController.getObject',
      'StorageController.getSignedUrl',
      'StorageController.getSignedUrls',
      'TimeController.getNow',
    ]);
  });
});
