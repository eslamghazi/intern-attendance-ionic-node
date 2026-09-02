// Reference data: institutions, branches, groups, shifts.
//
// Replaces the direct PostgREST calls in ClientApp/src/lib/api/catalog.ts.
// Every handler runs inside asCaller(), so who may read or write each table is
// still decided by the policies in the database — these routes add no
// authorization of their own, exactly as PostgREST added none.
//
// What they DO add is a column whitelist. PostgREST let the client name the
// columns it wrote and relied on policies to constrain them; here the payload
// is projected onto an explicit list, so a new sensitive column cannot become
// client-writable just by existing.
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { asCaller, qualified, query, type DbContext } from '../db/context.js';
import { badRequest, notFound } from '../http/errors.js';

/** jsonb columns must be sent as JSON text: node-pg would otherwise encode a JS
 *  array as a Postgres array literal, which jsonb rejects. */
const JSONB_COLUMNS = new Set(['area_coords']);

function coerce(column: string, value: unknown): unknown {
  if (value !== null && value !== undefined && JSONB_COLUMNS.has(column)) {
    return JSON.stringify(value);
  }
  return value === undefined ? null : value;
}

async function insertRow(tx: DbContext, table: string, payload: Record<string, unknown>) {
  const cols = Object.keys(payload);
  if (!cols.length) throw badRequest('empty', 'nothing to insert');
  const names = sql.join(cols.map((c) => sql.identifier(c)), sql`, `);
  const values = sql.join(cols.map((c) => sql`${coerce(c, payload[c])}`), sql`, `);
  const rows = await query<{ id: string }>(tx, sql`
    insert into ${qualified(table)} (${names}) values (${values}) returning id
  `);
  return rows[0]!;
}

async function updateRow(tx: DbContext, table: string, id: string, payload: Record<string, unknown>) {
  const cols = Object.keys(payload);
  if (!cols.length) throw badRequest('empty', 'nothing to update');
  const assignments = sql.join(
    cols.map((c) => sql`${sql.identifier(c)} = ${coerce(c, payload[c])}`),
    sql`, `,
  );
  const rows = await query<{ id: string }>(tx, sql`
    update ${qualified(table)} set ${assignments} where id = ${id} returning id
  `);
  // Zero rows means either no such id, or RLS hid it from this caller. Both are
  // "not found" as far as the caller is allowed to know.
  if (!rows[0]) throw notFound();
  return rows[0];
}

async function deleteRow(tx: DbContext, table: string, id: string) {
  const rows = await query<{ id: string }>(tx, sql`
    delete from ${qualified(table)} where id = ${id} returning id
  `);
  if (!rows[0]) throw notFound();
}

/** Pick only the keys the client is allowed to write, dropping undefined. */
function project<T extends object>(body: T, keys: readonly (keyof T & string)[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

const uuid = z.string().uuid();

/* ------------------------------------------------------------------ schemas */

const institutionBody = z.object({
  name: z.string().trim().min(1),
  code: z.coerce.number().int().default(0),
});

const branchBody = z.object({
  name: z.string().trim().min(1),
  address: z.string().nullish(),
  latitude: z.number(),
  longitude: z.number(),
  radius_meters: z.coerce.number().int(),
  // >= 3 vertices makes it a polygon geofence; anything less means "circle".
  area_coords: z.array(z.unknown()).nullish(),
  institution_id: uuid.nullish(),
  bypass_face: z.boolean().default(false),
  bypass_location: z.boolean().default(false),
  bypass_checkout_window: z.boolean().default(false),
  require_qr: z.boolean().default(false),
  qr_enabled: z.boolean().default(true),
  block_checkin: z.boolean().default(false),
});

const groupBody = z.object({
  name: z.string().trim().min(1),
  year: z.coerce.number().int(),
  institution_id: uuid.nullish(),
  branch_id: uuid.nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  bypass_face: z.boolean().default(false),
  bypass_location: z.boolean().default(false),
  bypass_checkout_window: z.boolean().default(false),
});

const shiftBody = z.object({
  name: z.string().trim().min(1),
  key: z.string().nullish(),
  checkin_open: z.string().nullish(),
  checkin_late: z.string().nullish(),
  checkin_close: z.string().nullish(),
  checkout_open: z.string().nullish(),
  checkout_close: z.string().nullish(),
  start_time: z.string(),
  end_time: z.string(),
});

/* ------------------------------------------------------------------- routes */

export const catalogRoutes: FastifyPluginAsync = async (app) => {
  const list = (path: string, table: string, orderBy: string) =>
    app.get(path, async (req) =>
      asCaller(req.claims, async (tx) => {
        const rows = await query(tx, sql`
          select * from ${qualified(table)} order by ${sql.raw(orderBy)}
        `);
        return rows;
      }),
    );

  const options = (path: string, table: string) =>
    app.get(path, async (req) =>
      asCaller(req.claims, async (tx) => {
        const rows = await query(tx, sql`
          select id, name from ${qualified(table)} order by name, id
        `);
        return rows;
      }),
    );

  // Ordering matches what the client asked PostgREST for, so lists render
  // identically before and after the switch.
  list('/institutions', 'institutions', 'code, id');
  list('/branches', 'branches', 'name, id');
  list('/groups', 'groups', 'year desc, id');
  list('/shifts', 'shifts', 'start_time, id');
  options('/branches/options', 'branches');
  options('/groups/options', 'groups');

  app.get('/shifts/keys', async (req) =>
    asCaller(req.claims, async (tx) => {
      const rows = await query(tx, sql`select id, key from public.shifts order by id`);
      return rows;
    }),
  );

  /** One create/update/delete trio per table, all sharing the helpers above. */
  const crud = <S extends z.ZodTypeAny>(
    base: string,
    table: string,
    schema: S,
    columns: readonly string[],
    normalise?: (v: z.infer<S>) => Record<string, unknown>,
  ) => {
    app.post(base, async (req, reply) => {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) throw badRequest('invalid', `invalid ${table} payload`);
      const payload = normalise
        ? normalise(parsed.data)
        : project(parsed.data as object, columns as never);
      const row = await asCaller(req.claims, (tx) => insertRow(tx, table, payload));
      reply.code(201);
      return row;
    });

    app.patch(`${base}/:id`, async (req) => {
      const { id } = req.params as { id: string };
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) throw badRequest('invalid', `invalid ${table} payload`);
      const payload = normalise
        ? normalise(parsed.data)
        : project(parsed.data as object, columns as never);
      return asCaller(req.claims, (tx) => updateRow(tx, table, id, payload));
    });

    app.delete(`${base}/:id`, async (req, reply) => {
      const { id } = req.params as { id: string };
      await asCaller(req.claims, (tx) => deleteRow(tx, table, id));
      reply.code(204);
    });
  };

  crud('/institutions', 'institutions', institutionBody, ['name', 'code']);

  crud('/branches', 'branches', branchBody, [], (b) => ({
    name: b.name,
    address: b.address || null,
    latitude: b.latitude,
    longitude: b.longitude,
    radius_meters: b.radius_meters,
    // Fewer than 3 vertices is not a polygon; store null so the geofence
    // trigger falls back to the radius circle.
    area_coords: b.area_coords && b.area_coords.length >= 3 ? b.area_coords : null,
    institution_id: b.institution_id || null,
    bypass_face: b.bypass_face,
    bypass_location: b.bypass_location,
    bypass_checkout_window: b.bypass_checkout_window,
    require_qr: b.require_qr,
    // Requiring QR forces the feature on, otherwise nobody could check in.
    qr_enabled: b.require_qr ? true : b.qr_enabled,
    block_checkin: b.block_checkin,
  }));

  crud('/groups', 'groups', groupBody, [], (g) => ({
    name: g.name,
    year: g.year,
    institution_id: g.institution_id || null,
    branch_id: g.branch_id || null,
    start_date: g.start_date || null,
    end_date: g.end_date || null,
    bypass_face: g.bypass_face,
    bypass_location: g.bypass_location,
    bypass_checkout_window: g.bypass_checkout_window,
  }));

  crud('/shifts', 'shifts', shiftBody, [], (s) => ({
    name: s.name,
    key: s.key || null,
    checkin_open: s.checkin_open || null,
    checkin_late: s.checkin_late || null,
    checkin_close: s.checkin_close || null,
    checkout_open: s.checkout_open || null,
    checkout_close: s.checkout_close || null,
    // start/end are display-only mirrors of the windows; kept for legacy code.
    start_time: s.checkin_late || s.start_time,
    end_time: s.checkout_open || s.end_time,
    late_grace_minutes: 0,
    late_from: null,
    late_to: null,
  }));
};
