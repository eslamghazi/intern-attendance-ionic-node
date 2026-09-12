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
// diffs against the LIVE database and emits whatever makes it match the models.
// There is nothing left for it to destroy — the triggers moved into
// application code; see src/domain/member/code.ts.
//
// The models are the source of truth. Edit them, then `npm run db:generate`.
import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/database/schema/index.ts',
  // Generated migrations, applied in order by scripts/migrate.mjs.
  out: './db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
    ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: false } : false,
  },
  // Everything this project owns lives in `public`. It used to pull in two
  // more schemas that belonged to a hosted platform's own services; both went
  // with that platform, and naming a schema that does not exist makes every
  // introspection fail.
  schemaFilter: ['public'],
  // The migration runner's own bookkeeping is not part of the model.
  tablesFilter: ['!_migrations'],
  // snake_case in the database, camelCase in TypeScript.
  casing: 'snake_case',
  verbose: true,
  strict: true,
});
