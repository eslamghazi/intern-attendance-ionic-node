// drizzle-kit — DATABASE-FIRST, introspection only.
//
// MODEL-FIRST, with one hard exclusion.
//
// `drizzle-kit generate` is supported: it diffs the models against its own
// SNAPSHOT — not against the live database — and emits SQL for what it models:
// tables, columns, indexes, foreign keys, RLS policies, views and enums. It
// never touches what it does not track.
//
// `drizzle-kit push` is NOT, and `npm run db:push` refuses to run it. push
// diffs against the LIVE database, where it would see the 40 functions, 3
// triggers and 2 scheduled jobs it has no concept of and drop them. Those live
// in db/functions and are re-applied after every migration.
//
// After any hand-written change to something the models DO cover, run
// `npm run db:pull` to bring the models and the snapshot back in step —
// otherwise the next generate will try to undo it.
import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  // Generated migrations, applied in order by scripts/migrate.mjs.
  out: './db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
    ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: false } : false,
  },
  // The app reads auth.users (staff password hashes) and storage.objects
  // (bucket policies are evaluated against it), so both come along.
  schemaFilter: ['public', 'auth', 'storage'],
  // PostGIS installs its own catalog tables and views (spatial_ref_sys,
  // geography_columns, geometry_columns). They belong to the extension, not to
  // this application, and pulling them in adds 200 lines of noise plus columns
  // drizzle-kit cannot type either.
  extensionsFilters: ['postgis'],
  // The migration runner's own bookkeeping is not part of the model.
  tablesFilter: ['!_migrations', '!spatial_ref_sys', '!geography_columns', '!geometry_columns'],
  // snake_case in the database, camelCase in TypeScript.
  casing: 'snake_case',
  verbose: true,
  strict: true,
});
