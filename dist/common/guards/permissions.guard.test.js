import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard.js';
import { AnyStaff, Page } from '../decorators/page.decorator.js';
import { Public } from '../decorators/public.decorator.js';
import { Role } from '../enums/index.js';
import { ApiError } from '../errors.js';
/**
 * A handler with the given decorators, and a context that points at it.
 *
 * Nest stores decorator metadata on the function, so a bare function with the
 * decorator applied by hand is exactly what the guard would see in a request.
 */
function route(decorators, caller) {
    class Ctl {
        handler() { }
    }
    for (const d of decorators) {
        d(Ctl.prototype, 'handler', Object.getOwnPropertyDescriptor(Ctl.prototype, 'handler'));
    }
    return {
        getHandler: () => Ctl.prototype.handler,
        getClass: () => Ctl,
        switchToHttp: () => ({ getRequest: () => ({ caller }) }),
    };
}
const guard = new PermissionsGuard(new Reflector());
const status = (ctx) => {
    try {
        guard.canActivate(ctx);
        return 'ok';
    }
    catch (err) {
        return err instanceof ApiError ? err.status : -1;
    }
};
const admin = (permissions) => ({ id: 'a', role: Role.ADMIN, permissions });
const superadmin = { id: 's', role: Role.SUPERADMIN };
const member = { id: 'm', role: Role.MEMBER };
describe('who the guard never questions', () => {
    it('a public route, even with no caller', () => {
        expect(status(route([Public()], null))).toBe('ok');
    });
    it('a superadmin, on any route, whatever the column says', () => {
        expect(status(route([Page('members', 'delete')], superadmin))).toBe('ok');
        expect(status(route([], superadmin))).toBe('ok');
    });
    it('a member — their access is a matter of role, not of pages', () => {
        expect(status(route([Page('members', 'delete')], member))).toBe('ok');
    });
});
describe('an admin', () => {
    it('with no caller at all is unauthenticated, not forbidden', () => {
        expect(status(route([Page('members')], null))).toBe(401);
    });
    it('is refused a route that says nothing — the net under routes.spec.ts', () => {
        expect(status(route([], admin({ pages: ['members'] })))).toBe(403);
    });
    it('passes an @AnyStaff route with no grant at all', () => {
        expect(status(route([AnyStaff()], admin(null)))).toBe('ok');
    });
    it('needs the page', () => {
        expect(status(route([Page('members')], admin(null)))).toBe(403);
        expect(status(route([Page('members')], admin({ pages: ['audit'] })))).toBe(403);
        expect(status(route([Page('members')], admin({ pages: ['members'] })))).toBe('ok');
    });
    it('needs the operation too, when the route names one', () => {
        const readOnly = admin({ pages: ['members'] });
        const editor = admin({ pages: ['members'], pageOps: { members: ['edit'] } });
        expect(status(route([Page('members', 'edit')], readOnly))).toBe(403);
        expect(status(route([Page('members', 'edit')], editor))).toBe('ok');
        expect(status(route([Page('members', 'delete')], editor))).toBe(403);
    });
});
//# sourceMappingURL=permissions.guard.test.js.map