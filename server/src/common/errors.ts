// A single error shape for the whole API.
//
// The client's dbError.ts already classifies failures by a code string, and
// useServerReachable.ts distinguishes "the server is down" from "this one call
// failed" — so a 500 must stay a normal error response and never look like an
// outage. Keep the envelope stable: { error: { code, message } }.
// Everything an error carries to the client is JSON, because that is what the
// client receives. JsonValue rather than `unknown` says the same thing and
// still allows a value to be read without first casting it.
import type { JsonObject, JsonValue } from './json.types.js';

export interface PgErrorInfo {
  code?: string;
  message?: string;
  details?: string;
  table?: string;
}

export class ApiError extends Error {
  /** Raw Postgres error info, when the failure came from the database. */
  pg?: PgErrorInfo;

  /**
   * Verbatim response body, replacing the standard error envelope. The check-in
   * flow answers with `{ reason, … }` and the client switches on that reason to
   * pick its message — so those refusals must keep their original shape.
   */
  payload?: JsonObject;

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: JsonValue,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const unauthorized = (msg = 'not authenticated') =>
  new ApiError(401, 'unauthorized', msg);

export const forbidden = (msg = 'not allowed') => new ApiError(403, 'forbidden', msg);

export const notFound = (msg = 'not found') => new ApiError(404, 'not_found', msg);

export const badRequest = (code: string, msg: string, details?: JsonValue) =>
  new ApiError(400, code, msg, details);

export const conflict = (code: string, msg: string) => new ApiError(409, code, msg);

/** Postgres error codes that map to a meaningful HTTP status rather than a 500. */
const PG_STATUS: Record<string, [number, string]> = {
  '23505': [409, 'duplicate'], // unique_violation
  '23503': [409, 'fk_violation'], // foreign_key_violation
  '23514': [400, 'check_violation'], // check_violation
  '22P02': [400, 'invalid_input'], // invalid_text_representation
  '42501': [403, 'forbidden'], // insufficient_privilege
  '40001': [409, 'serialization'], // serialization_failure
};

/**
 * Dig the original Postgres error out of whatever wrapped it.
 *
 * drizzle does not rethrow the driver's error: it throws a DrizzleQueryError
 * carrying the query and params, with the real one on `.cause`. So `err.code`
 * is undefined, so a naive `err.code` lookup matches NOTHING and every one of
 * these — a duplicate national id, a foreign key still in use, a failed check
 * constraint — arrives at the client as a 500.
 *
 * That is worse than a wrong status code here. The client reads 5xx as an
 * outage and shows a full-screen "server is down", so a member mistyping
 * something looked like a broken backend, and the "can't delete, it's still
 * linked to X" message the client builds from the pg fields never appeared.
 *
 * Walks the chain rather than checking one level: nothing guarantees the
 * driver error is exactly one wrapper deep.
 */
function unwrapPgError(err: unknown): { code?: string; message?: string; detail?: string; table?: string } {
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as { code?: string; cause?: unknown };
    // A Postgres SQLSTATE is five alphanumeric characters. Fastify's own errors
    // use codes like FST_ERR_CTP_EMPTY_JSON_BODY, which must not be mistaken
    // for one.
    if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code)) {
      return candidate as { code: string; message?: string; detail?: string; table?: string };
    }
    current = candidate.cause;
  }
  return err as { code?: string; message?: string; detail?: string; table?: string };
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  // `throw null` and `throw 'a string'` are both legal, and a property read on
  // either throws inside the error handler — where there is nothing left to
  // catch it.
  const outer = (typeof err === 'object' && err !== null ? err : {}) as {
    statusCode?: number;
    code?: string;
    message?: string;
  };
  const pg = unwrapPgError(outer) as {
    code?: string;
    message?: string;
    detail?: string;
    table?: string;
    statusCode?: number;
  };

  // NestJS HttpException (ValidationPipe, BadRequestException, UnauthorizedException, etc.)
  if (typeof (err as any)?.getStatus === 'function') {
    const status = (err as any).getStatus();
    const response = (err as any).getResponse?.();
    const message =
      typeof response === 'object' && response !== null && 'message' in response
        ? Array.isArray((response as any).message)
          ? (response as any).message.join(', ')
          : String((response as any).message)
        : (err as any).message || 'request rejected';
    const code =
      typeof response === 'object' && response !== null && 'error' in response
        ? String((response as any).error).toLowerCase().replace(/\s+/g, '_')
        : (err as any).code ?? 'bad_request';
    return new ApiError(status, code, message);
  }

  // Fastify core and plugin errors already carry the right status: rate limit
  // (429), malformed JSON (400), payload too large (413), bad content type
  // (415). Collapsing those into a 500 is not just a wrong code — the client
  // reads 5xx as "the server is down" and shows a full-screen outage, so a
  // rate-limited login would look like a broken backend.
  // Read from the OUTER error: the status belongs to Fastify's wrapper, not to
  // any database error underneath it.
  const status = outer.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return new ApiError(status, outer.code ?? 'bad_request', outer.message ?? 'request rejected');
  }

  if (pg.code && PG_STATUS[pg.code]) {
    const [status, apiCode] = PG_STATUS[pg.code]!;
    const api = new ApiError(status, apiCode, pg.message ?? apiCode);
    // The client's dbError.ts turns a foreign-key violation into "can't delete,
    // it's still linked to <table>" by reading the raw Postgres code and the
    // `referenced from table "x"` text. Pass both through unchanged so that
    // translation keeps working.
    api.pg = { code: pg.code, message: pg.message, details: pg.detail, table: pg.table };
    return api;
  }
  return new ApiError(500, 'internal', 'internal server error');
}
