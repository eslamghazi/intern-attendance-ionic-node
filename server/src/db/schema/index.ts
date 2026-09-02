// The models — the source of truth for tables, columns, indexes, foreign keys,
// RLS policies, views and enums.
//
// MODEL-FIRST. Edit these files, then:
//
//   npm run db:generate   # drizzle-kit writes the SQL into db/migrations
//   npm run migrate       # applies it, then re-applies db/functions
//
// What the models CANNOT describe — functions, triggers, scheduled jobs —
// lives in db/functions as ordinary SQL. Every file there is CREATE OR REPLACE
// and the whole directory is re-applied after each migration, so a function
// stays in step with a column the models just changed underneath it.
//
// `db:push` remains blocked: it diffs against the live database and would drop
// the functions and triggers it cannot see. `db:pull` still exists for the
// opposite direction — bringing the models back in step after a hand-written
// change — and re-running it overwrites tables.ts and relations.ts.
export * from './types.js';
export * from './tables.js';
export * from './relations.js';
