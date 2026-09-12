var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { Role } from '../enums/index.js';
import { unauthorized, forbidden } from '../errors.js';
/**
 * What a route gets when it declares nothing.
 *
 * FAIL CLOSED. A route with no @Roles and no @Public is staff-only.
 *
 * The tempting default is "any signed-in caller", and it is wrong in a specific
 * way: the failure is SILENT. A new route that forgets its decorator serves
 * every member in the faculty and nothing anywhere reports it — not a test, not
 * a log, not a 500. Closed, the same mistake denies a request, which someone
 * notices within minutes of trying the feature.
 *
 * The cost asymmetry is the whole argument. Denying a member something they
 * should have is a bug report. Granting a member PATCH /members/:id — whose
 * writable columns include `bypass_face` and `bypass_location` — lets them
 * switch off the biometric and the geofence for themselves.
 *
 * This is a BACKSTOP, not the mechanism: routes.spec.ts fails the build if any
 * route relies on it, so every route says what it wants out loud.
 */
const DEFAULT_ROLES = [Role.ADMIN, Role.SUPERADMIN];
let RolesGuard = class RolesGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        // @Public() is checked by AuthGuard too; repeated here because this guard
        // must not demand a role on a route that deliberately has no caller.
        const isPublic = this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic)
            return true;
        const declared = this.reflector.getAllAndOverride(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const requiredRoles = declared?.length ? declared : DEFAULT_ROLES;
        const request = context.switchToHttp().getRequest();
        const caller = request.caller ?? request.raw?.caller;
        if (!caller) {
            throw unauthorized();
        }
        if (!requiredRoles.includes(caller.role)) {
            throw forbidden();
        }
        return true;
    }
};
RolesGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [Reflector])
], RolesGuard);
export { RolesGuard };
//# sourceMappingURL=roles.guard.js.map