// What the exception filter is handed.
//
// `ctx.getRequest()` and `ctx.getResponse()` are generic on purpose — Nest does
// not know which HTTP adapter is underneath — so the type is ours to state. It
// was stated as `any`, which is how `request.url.startsWith` ended up on a
// value that might have been undefined.

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IncomingMessage } from 'http';
import type { JwtClaims } from '../../infrastructure/database/context.js';
import type { Caller } from '../types.js';

/** What the auth middleware attaches, on whichever object it could reach. */
export interface CallerAttachment {
  caller?: Caller | null;
  claims?: JwtClaims | null;
}

/**
 * A request as this filter reads it.
 *
 * The caller is looked for in two places because the middleware writes it to
 * both: Nest hands middleware the raw Node request under Fastify, while the
 * guards and decorators see the Fastify one wrapping it.
 */
export type ErrorRequest = FastifyRequest &
  CallerAttachment & {
    raw: IncomingMessage & CallerAttachment;
  };

/**
 * A reply as this filter writes it.
 *
 * `sendFile` comes from @fastify/static and is absent from Fastify's own types,
 * so it stays optional and is tested for before use — in a build serving no
 * static files there is no SPA to fall back to.
 */
export type ErrorReply = FastifyReply & {
  sendFile?: (path: string) => unknown;
};
