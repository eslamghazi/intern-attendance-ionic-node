import type { JwtClaims } from '../db/context.js';
import { Role } from './enums/index.js';

/** The signed-in person, as every handler sees them. Matches domain/identity/role.ts Caller exactly. */
export interface Caller {
  id: string;
  role: Role;
  nationalId?: string;
}

// Re-export for backward compatibility — prefer importing from common/enums directly.
export { Role as UserRole };

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
