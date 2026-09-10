import { Injectable, NestMiddleware } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { asService } from '../../db/context.js';
import * as schema from '../../db/schema/index.js';
import { bearerToken, verifyToken } from '../auth/jwt.js';
import { Role } from '../enums/index.js';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
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
      const profile = await asService(async (tx) => {
        const rows = await tx
          .select({ role: schema.profiles.role, isActive: schema.profiles.isActive })
          .from(schema.profiles)
          .where(eq(schema.profiles.id, claims.sub))
          .limit(1);
        return rows[0] ?? null;
      });

      if (profile && profile.isActive !== false) {
        const caller = {
          id: claims.sub,
          role: profile.role as Role,
          nationalId: claims.national_id,
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
