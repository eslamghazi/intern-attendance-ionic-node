import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Caller as CallerType } from '../types.js';
import type { JwtClaims } from '../../infrastructure/database/context.js';

export const Caller = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CallerType | null => {
    const request = ctx.switchToHttp().getRequest<any>();
    return request.caller ?? request.raw?.caller ?? null;
  },
);

export const Claims = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtClaims | null => {
    const request = ctx.switchToHttp().getRequest<any>();
    return request.claims ?? request.raw?.claims ?? null;
  },
);
