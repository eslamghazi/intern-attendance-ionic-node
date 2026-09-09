import type { AppRole } from './auth/jwt.js';
import type { JwtClaims } from '../db/context.js';

export interface Caller {
  id: string;
  role: AppRole;
  nationalId?: string;
}

export enum UserRole {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  MEMBER = 'member',
}

declare global {
  namespace Express {
    interface Request {
      caller: Caller | null;
      claims: JwtClaims | null;
    }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    caller?: Caller | null;
    claims?: JwtClaims | null;
  }
}
