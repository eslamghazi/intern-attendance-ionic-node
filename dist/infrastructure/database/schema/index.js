// The models — the source of truth for tables, columns, indexes, foreign keys,
// constraints, views and enums.
//
// MODEL-FIRST. Edit these files, then:
//
//   npm run db:generate   # drizzle-kit writes the SQL into db/migrations
//   npm run migrate       # applies it
//
// What the models CANNOT describe — the two triggers and the function each runs
// — is nothing: the two triggers that existed moved into the repositories, so
// drizzle-kit describes the entire schema and db/ holds only what it generated.
//
// `db:push` remains blocked: it diffs against the live database and would drop
// the triggers it cannot see. There is no `db:pull`: the models are the source
// of truth and the direction is one-way.
// Every column in this schema is a type Drizzle ships out of the box, which is
// what lets `drizzle-kit generate` describe the whole database from these files
// and lets the database itself need no extensions at all.
export * from './tables.js';
export * from './relations.js';
//# sourceMappingURL=index.js.map