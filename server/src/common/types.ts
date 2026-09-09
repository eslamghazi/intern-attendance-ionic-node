import type { Request } from 'express';
import type { AppRole } from '../auth/jwt.js';
import type { JwtClaims } from '../db/context.js';

export interface Caller {
  id: string;
  role: AppRole;
  nationalId?: string;
}

declare global {
  namespace Express {
    interface Request {
      caller: Caller | null;
      claims: JwtClaims | null;
    }
  }
}
