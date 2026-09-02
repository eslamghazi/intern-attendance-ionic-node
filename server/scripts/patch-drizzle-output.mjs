// Post-process drizzle-kit output — every correction in one place.
//
// Runs automatically after `db:pull` and `db:generate`. Nothing in the
// generated files is edited by hand: a hand-edit survives exactly until the
// next pull, and the fixes below are ones you cannot afford to lose silently.
//
// Each is a defect in what drizzle-kit produces, not a preference.
import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const log = (m) => console.log(`[patch] ${m}`);

/* ==========================================================================
 * ADOPT A PULL
 *
 * `drizzle-kit pull` writes its model files into its `out` directory
 * alongside a snapshot of the database it read. Only the models are wanted:
 * the SQL beside them describes a schema that already exists, and applying it
 * would be an attempt to create everything a second time. Move the models into
 * place and drop the rest.
 * ========================================================================== */
const PULL = join(ROOT, '.drizzle-pull');
const SCHEMA_DIR = join(ROOT, 'src', 'db', 'schema');
if (existsSync(join(PULL, 'schema.ts'))) {
  mkdirSync(SCHEMA_DIR, { recursive: true });
  renameSync(join(PULL, 'schema.ts'), join(SCHEMA_DIR, 'tables.ts'));
  if (existsSync(join(PULL, 'relations.ts'))) {
    renameSync(join(PULL, 'relations.ts'), join(SCHEMA_DIR, 'relations.ts'));
  }
  rmSync(PULL, { recursive: true, force: true });
  log('adopted the pulled models into src/db/schema');
}

/* ==========================================================================
 * MIGRATIONS
 * ========================================================================== */

const MIGRATIONS = join(ROOT, 'db', 'migrations');
if (existsSync(MIGRATIONS)) {
  let touched = 0;
  for (const name of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'))) {
    const path = join(MIGRATIONS, name);
    const before = readFileSync(path, 'utf8');
    const after = before
      // drizzle-kit quotes any type it does not know, so the PostGIS column
      // comes out as `"geom" "geography(Point,4326)"` — an identifier, not a
      // type — and Postgres reports that the type does not exist even though
      // PostGIS is installed. A column name can never contain parentheses, so a
      // quoted string that does is unambiguously a type.
      .replace(/"([a-z_]+\([^"]*\))"/g, '$1')
      // db/prelude.sql already created auth and storage: the functions the
      // policies call live in them and cannot wait for this file.
      .replace(/^CREATE SCHEMA "/gm, 'CREATE SCHEMA IF NOT EXISTS "');
    if (after !== before) {
      writeFileSync(path, after, 'utf8');
      touched++;
      log(`fixed generated SQL in migrations/${name}`);
    }
  }
  if (!touched) log('migrations needed no fixing');
}

/* ==========================================================================
 * MODELS — only present after `drizzle-kit pull`
 * ========================================================================== */

const TABLES = join(ROOT, 'src', 'db', 'schema', 'tables.ts');
if (!existsSync(TABLES)) {
  log('no models file to patch');
  process.exit(0);
}

let src = readFileSync(TABLES, 'utf8');
const notes = [];

/* -- 1. PostGIS columns ---------------------------------------------------
 * drizzle-kit cannot type `geography` and emits `unknown("geom")`, which is
 * not a column builder — the file does not even compile. */
const GEO = /[ \t]*\/\/ TODO: failed to parse database type 'geography'\n([ \t]*)(\w+): unknown\("([^"]+)"\),/g;
const geoHits = [...src.matchAll(GEO)];
if (geoHits.length) {
  src = src.replace(GEO, (_m, indent, prop, column) => `${indent}${prop}: geography("${column}"),`);
  if (!src.includes("from './types.js'")) {
    src = src.replace(
      /^(import \{ sql \} from "drizzle-orm"\n)/m,
      `$1import { geography } from './types.js'\n`,
    );
  }
  notes.push(`typed ${geoHits.length} geography column(s)`);
}

/* -- 2. View options ------------------------------------------------------
 * The option is read back as the STRING Postgres stores, but the type wants a
 * boolean. That the option is there at all matters: member_directory must run
 * with the caller's rights or its RLS is bypassed for everyone. */
const invoker = /\.with\(\{\s*"?securityInvoker"?:\s*"(on|off)"\s*\}\)/g;
if (invoker.test(src)) {
  src = src.replace(invoker, (_m, v) => `.with({ securityInvoker: ${v === 'on'} })`);
  notes.push('fixed securityInvoker option(s)');
}

/* -- 3. RLS policies ------------------------------------------------------
 * REMOVED ENTIRELY. drizzle-kit can express pgPolicy but cannot round-trip
 * one: 32 of 47 came back with their USING and WITH CHECK expressions dropped,
 * and a policy with no USING means USING (true) — it permits everything to
 * everyone holding the role. The authorization model lives in
 * db/functions/015_policies.sql instead. */
let removedPolicies = 0;
for (;;) {
  const at = src.indexOf('pgPolicy(');
  if (at === -1) break;
  // Match parentheses so a multi-line entry is removed whole.
  let depth = 0;
  let end = at;
  for (let i = src.indexOf('(', at); i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  // Take the trailing comma and the blank line the entry leaves behind.
  while (src[end] === ',') end++;
  let start = at;
  while (start > 0 && (src[start - 1] === ' ' || src[start - 1] === '\t')) start--;
  if (src[end] === '\n') end++;
  src = src.slice(0, start) + src.slice(end);
  removedPolicies++;
}
if (removedPolicies) {
  src = src.replace(/import \{([^}]*)\} from "drizzle-orm\/pg-core"/, (_m, g) => {
    const kept = g
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x && x !== 'pgPolicy');
    return `import { ${kept.join(', ')} } from "drizzle-orm/pg-core"`;
  });
  notes.push(`removed ${removedPolicies} pgPolicy entr(ies)`);
}

/* -- 4. Index operator classes -------------------------------------------
 * drizzle-kit copies the FIRST column's operator class onto every column of a
 * composite index, producing `date_ops` on a uuid and `timestamptz_ops` on
 * text, neither of which will create. Every class it writes for btree is the
 * default for its type anyway, so dropping them is both correct and immune. */
let strippedOps = 0;
src = src
  .split('\n')
  .map((line) => {
    if (!line.includes('using("btree"')) return line;
    const next = line.replace(/\.op\("[a-z0-9_]+"\)/g, '');
    if (next !== line) strippedOps++;
    return next;
  })
  .join('\n');
if (strippedOps) notes.push(`stripped default op classes from ${strippedOps} btree index(es)`);

/* -- 5. Empty array defaults ---------------------------------------------
 * `'{}'` is read back as `[""]` — an array holding one empty string — which
 * then fails as `invalid input syntax for type uuid: ""`. */
const emptyArray = /\.array\(\)\.default\(\[""\]\)/g;
if (emptyArray.test(src)) {
  src = src.replace(emptyArray, '.array().default([])');
  notes.push('fixed empty array default(s)');
}

/* -- 6. Explain the above, in the file itself ----------------------------- */
const BANNER = `
// This file is GENERATED by \`npm run db:pull\` and then corrected by
// scripts/patch-drizzle-output.mjs. Do not edit it by hand — the next pull
// overwrites it. Change the schema by editing the models and running
// \`npm run db:generate\`, or by adding SQL under db/functions.
//
// The patch script fixes, every time: PostGIS column types, the securityInvoker
// view option, composite-index operator classes, empty array defaults, and it
// REMOVES all RLS policies — drizzle-kit drops their USING expressions, which
// would turn each one into "permit everyone". Policies live in
// db/functions/015_policies.sql.
`;
if (!src.includes('This file is GENERATED by')) {
  src = src.replace(/^(import \{ sql \} from "drizzle-orm"\n)/m, `$1${BANNER}`);
}

writeFileSync(TABLES, src, 'utf8');
log(notes.length ? notes.join('; ') : 'models needed no fixing');

/* -- 7. relations.ts ------------------------------------------------------
 * drizzle-kit emits an extensionless relative import, which NodeNext rejects. */
const REL = join(dirname(TABLES), 'relations.ts');
if (existsSync(REL)) {
  const before = readFileSync(REL, 'utf8');
  const after = before.replace(/from "\.\/(schema|tables)"/g, 'from "./tables.js"');
  if (after !== before) {
    writeFileSync(REL, after, 'utf8');
    log('pointed relations.ts at ./tables.js');
  }
}
