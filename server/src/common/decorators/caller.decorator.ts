import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Caller as CallerType } from '../types.js';
import type { JwtClaims } from '../../db/context.js';

export const Caller = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CallerType | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.caller ?? null;
  },
);

export const Claims = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtClaims | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.claims ?? null;
  },
);
