import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { asService } from '../../db/context.js';
import * as schema from '../../db/schema/index.js';
import { bearerToken, verifyToken } from '../../auth/jwt.js';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    req.caller = null;
    req.claims = null;

    const token = bearerToken(req.headers.authorization);
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
        req.caller = {
          id: claims.sub,
          role: profile.role,
          nationalId: claims.national_id,
        };
        req.claims = { ...claims, user_role: profile.role };
      }
    } catch (err) {
      console.error('[AuthMiddleware] Error reading profile:', err);
    }

    next();
  }
}
