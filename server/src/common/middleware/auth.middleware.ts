import { Injectable, NestMiddleware } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import * as schema from '../../infrastructure/database/schema/index.js';
import { bearerToken, verifyToken } from '../auth/jwt.js';
import { Role } from '../enums/index.js';
import type { Caller } from '../../domain/identity/types.js';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly uow: UnitOfWorkService) {}

  async use(req: any, res: any, next: (error?: any) => void) {
    req.caller = null;
    req.claims = null;
    if (req.raw) {
      req.raw.caller = null;
      req.raw.claims = null;
    }

    const authHeader = req.headers?.authorization ?? req.raw?.headers?.authorization;
    const token = bearerToken(authHeader);
    if (!token) {
      return next();
    }

    const claims = verifyToken(token);
    if (!claims) {
      return next();
    }

    try {
      const profile = await this.uow.transaction(async (tx) => {
        const rows = await tx
          .select({
            role: schema.profiles.role,
            isActive: schema.profiles.isActive,
            // The grant rides along on the lookup this middleware already
            // makes, so PermissionsGuard costs no query of its own — and it
            // is read fresh on every request, so taking a page away from an
            // admin takes effect on their next click, not their next sign-in.
            permissions: schema.profiles.permissions,
          })
          .from(schema.profiles)
          .where(eq(schema.profiles.id, claims.sub))
          .limit(1);
        return rows[0] ?? null;
      });

      if (profile && profile.isActive !== false) {
        const role = profile.role as Role;
        const caller: Caller = {
          id: claims.sub,
          role,
          nationalId: claims.national_id,
          // Only an admin has a grant to carry. A superadmin's column is
          // whatever a superadmin once was before promotion; ignoring it here
          // is what keeps "superadmin passes everything" true.
          ...(role === Role.ADMIN ? { permissions: profile.permissions ?? null } : {}),
        };
        const claimsWithRole = { ...claims, user_role: profile.role as Role };

        req.caller = caller;
        req.claims = claimsWithRole;
        if (req.raw) {
          req.raw.caller = caller;
          req.raw.claims = claimsWithRole;
        }
      }
    } catch (err) {
      console.error('[AuthMiddleware] Error reading profile:', err);
    }

    next();
  }
}
