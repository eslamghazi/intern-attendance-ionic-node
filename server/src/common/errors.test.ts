import { describe, expect, it } from 'vitest';
import { ApiError, badRequest, toApiError } from './errors.js';

/** What drizzle actually throws: the query, with the driver error on `.cause`. */
function drizzleWrapped(pgError: unknown) {
  const err = new Error('Failed query: insert into public.attachments …');
  err.name = 'DrizzleQueryError';
  (err as Error & { cause?: unknown }).cause = pgError;
  return err;
}

const pgError = (code: string, message: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(message), { code, ...extra });

describe('toApiError', () => {
  it('passes an ApiError through untouched', () => {
    const original = badRequest('nope', 'no');
    expect(toApiError(original)).toBe(original);
  });

  it('unwraps a Postgres error drizzle wrapped', () => {
    // The regression this file exists for: drizzle puts the driver error on
    // `.cause`, so reading err.code off the wrapper found nothing and every
    // database failure became a 500 — which the client shows as an outage.
    const api = toApiError(
      drizzleWrapped(pgError('42501', 'permission denied for table members')),
    );
    expect(api.status).toBe(403);
    expect(api.code).toBe('forbidden');
  });

  it('maps the constraint violations the client translates', () => {
    expect(toApiError(drizzleWrapped(pgError('23505', 'duplicate key'))).status).toBe(409);
    expect(toApiError(drizzleWrapped(pgError('23503', 'still referenced'))).status).toBe(409);
    expect(toApiError(drizzleWrapped(pgError('23514', 'check failed'))).status).toBe(400);
    expect(toApiError(drizzleWrapped(pgError('22P02', 'bad uuid'))).status).toBe(400);
  });

  it('keeps the raw pg fields the client reads', () => {
    // dbError.ts turns these into "can't delete, it's still linked to members".
    const api = toApiError(
      drizzleWrapped(
        pgError('23503', 'update or delete violated a constraint', {
          detail: 'Key is still referenced from table "members".',
          table: 'branches',
        }),
      ),
    );
    expect(api.pg).toEqual({
      code: '23503',
      message: 'update or delete violated a constraint',
      details: 'Key is still referenced from table "members".',
      table: 'branches',
    });
  });

  it('still maps an unwrapped driver error', () => {
    expect(toApiError(pgError('23505', 'duplicate key')).status).toBe(409);
  });

  it('follows more than one layer of wrapping', () => {
    expect(toApiError(drizzleWrapped(drizzleWrapped(pgError('42501', 'denied')))).status).toBe(403);
  });

  it('does not mistake a Fastify error code for a SQLSTATE', () => {
    // FST_ERR_CTP_EMPTY_JSON_BODY is a code too, and must keep its own status
    // rather than being looked up in the SQLSTATE table.
    const fastifyErr = Object.assign(new Error('Body cannot be empty'), {
      code: 'FST_ERR_CTP_EMPTY_JSON_BODY',
      statusCode: 400,
    });
    const api = toApiError(fastifyErr);
    expect(api.status).toBe(400);
    expect(api.code).toBe('FST_ERR_CTP_EMPTY_JSON_BODY');
  });

  it('keeps a rate-limit 429 out of the 5xx range', () => {
    // A 500 here would make a rate-limited login look like a dead server.
    const limited = Object.assign(new Error('Too many requests'), {
      statusCode: 429,
      code: 'FST_ERR_RATE_LIMIT',
    });
    expect(toApiError(limited).status).toBe(429);
  });

  it('falls back to 500 for anything genuinely unexpected', () => {
    const api = toApiError(new Error('boom'));
    expect(api.status).toBe(500);
    expect(api.code).toBe('internal');
    // Never echo the original message: it can carry a query or a parameter.
    expect(api.message).toBe('internal server error');
  });

  it('is an ApiError in every case', () => {
    expect(toApiError('a string')).toBeInstanceOf(ApiError);
    expect(toApiError(null)).toBeInstanceOf(ApiError);
    expect(toApiError(undefined)).toBeInstanceOf(ApiError);
  });
});
