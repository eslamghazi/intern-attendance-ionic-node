import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ANY_STAFF_KEY, PAGE_KEY, type PageRequirementMetadata } from '../decorators/page.decorator.js';
import { Role } from '../enums/index.js';
import { grantAllows } from '../../domain/identity/permissions.js';
import type { Caller } from '../../domain/identity/types.js';
import { forbidden, unauthorized } from '../errors.js';

/**
 * The third gate, after AuthGuard (who are you) and RolesGuard (what kind of
 * account): for an ADMIN, has the superadmin granted the page this route
 * belongs to, and the operation it performs?
 *
 * WHY THIS EXISTS
 *
 * The per-page grants were stored by the server and read only by the client.
 * The editor could take the members page away from an admin, and the menu
 * would hide it — while `DELETE /members/:id` went on answering them, because
 * the only thing standing between an admin and any staff route was their role.
 * A grant that only removes buttons is not a grant.
 *
 * FAIL CLOSED, LIKE RolesGuard. An admin-reachable route that declares neither
 * @Page nor @AnyStaff is refused to admins. routes.spec.ts fails the build on
 * such a route, so the refusal is a safety net rather than something a route
 * relies on — but the net is there, because a forgotten decorator must deny
 * loudly, not grant silently.
 *
 * Superadmins pass: they hold every page by definition, and the grant editor
 * cannot even be pointed at them. Members pass: their access is a matter of
 * role, decided by RolesGuard, and the page vocabulary does not describe them.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<{ caller?: Caller; raw?: { caller?: Caller } }>();
    const caller = request.caller ?? request.raw?.caller;
    if (!caller) throw unauthorized();
    if (caller.role !== Role.ADMIN) return true;

    if (this.reflector.getAllAndOverride<boolean>(ANY_STAFF_KEY, targets)) return true;

    const need = this.reflector.getAllAndOverride<PageRequirementMetadata>(PAGE_KEY, targets);
    if (!need) throw forbidden('this route is not granted to admins');

    if (!grantAllows(caller.permissions, need.pages, need.op)) {
      throw forbidden('not granted');
    }
    return true;
  }
}
