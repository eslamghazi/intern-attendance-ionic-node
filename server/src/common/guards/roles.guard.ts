import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AppRole } from '../auth/jwt.js';
import { unauthorized, forbidden } from '../../http/errors.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<any>();
    const caller = request.caller ?? request.raw?.caller;
    if (!caller) {
      throw unauthorized();
    }

    if (!requiredRoles.includes(caller.role)) {
      throw forbidden();
    }

    return true;
  }
}
