// Prove the model-first build reproduces the schema the 72 legacy migrations
// produced.
//
// The models cannot be trusted just because they came from an introspection:
// drizzle-kit dropped 32 of 47 policy expressions on the way out, and each
// rebuild has surfaced another defect. So the two databases are compared on
// what Postgres itself reports — every column, constraint, index, POLICY
// EXPRESSION, function body, trigger, grant and seed row.
//
// "identical" here is the only thing that makes it safe to retire db/legacy.
//
//   REFERENCE_DATABASE_URL=…:5433/attendance \
//   CANDIDATE_DATABASE_URL=…:5434/attendance \
//   node scripts/verify-schema.mjs
import pg from 'pg';
import 'dotenv/config';

const REFERENCE = process.env.REFERENCE_DATABASE_URL;
const CANDIDATE = process.env.CANDIDATE_DATABASE_URL;

if (!REFERENCE || !CANDIDATE || REFERENCE === CANDIDATE) {
  console.error(
    '[verify] REFERENCE_DATABASE_URL (built from db/legacy) and\n' +
      '         CANDIDATE_DATABASE_URL (built from the models) must be two\n' +
      '         DIFFERENT databases.',
  );
  process.exit(1);
}

const S = `('public', 'auth', 'storage')`;

const PROBES = {
  tables: `
    select table_schema || '.' || table_name as line
      from information_schema.tables
     where table_schema in ${S} and table_name <> '_migrations'
     order by 1`,

  columns: `
    select table_schema || '.' || table_name || '.' || column_name ||
           ' :: ' || coalesce(udt_name, data_type) ||
           ' null=' || is_nullable ||
           ' default=' || coalesce(column_default, '-') as line
      from information_schema.columns
     where table_schema in ${S} and table_name <> '_migrations'
     order by 1`,

  // The reason this script exists.
  policies: `
    select schemaname || '.' || tablename || ' [' || policyname || '] ' ||
           cmd || ' permissive=' || permissive ||
           ' roles=' || array_to_string(roles::text[], ',') ||
           ' using=' || coalesce(qual, '-') ||
           ' check=' || coalesce(with_check, '-') as line
      from pg_policies where schemaname in ${S}
     order by 1`,

  rls_enabled: `
    select n.nspname || '.' || c.relname || ' rls=' || c.relrowsecurity as line
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ${S} and c.relkind = 'r' and c.relname <> '_migrations'
     order by 1`,

  constraints: `
    select n.nspname || '.' || r.relname || ': ' || pg_get_constraintdef(c.oid) as line
      from pg_constraint c
      join pg_class r on r.oid = c.conrelid
      join pg_namespace n on n.oid = r.relnamespace
     where n.nspname in ${S} and r.relname <> '_migrations'
     order by 1`,

  // Index NAMES are excluded: the legacy database still carries names from
  // before the tables were renamed (interns_pkey on members). The definition is
  // what matters.
  indexes: `
    select regexp_replace(indexdef, 'INDEX [a-z0-9_]+ ON', 'INDEX ON') as line
      from pg_indexes
     where schemaname in ${S} and tablename <> '_migrations'
     order by 1`,

  functions: `
    select pg_get_functiondef(p.oid) as line
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ${S}
       and p.oid not in (
         select objid from pg_depend where deptype = 'e' and classid = 'pg_proc'::regclass
       )
     order by 1`,

  views: `
    select table_name || ' = ' || regexp_replace(view_definition, '\\s+', ' ', 'g') as line
      from information_schema.views where table_schema = 'public'
     order by 1`,

  triggers: `
    select pg_get_triggerdef(t.oid) as line
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal
     order by 1`,

  enums: `
    select t.typname || ' = ' || string_agg(e.enumlabel, ',' order by e.enumsortorder) as line
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
     group by t.typname
     order by 1`,

  grants: `
    select grantee || ' ' || privilege_type || ' on ' || table_schema || '.' || table_name as line
      from information_schema.role_table_grants
     where table_schema in ${S}
       and grantee in ('anon', 'authenticated', 'service_role')
       and table_name <> '_migrations'
     order by 1`,

  seed_buckets: `select id || ' public=' || public as line from storage.buckets order by 1`,

  cron_jobs: `
    select jobname || ' @ ' || schedule || ' -> ' || command as line
      from cron.job order by 1`,
};

async function probe(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const out = {};
  for (const [name, query] of Object.entries(PROBES)) {
    try {
      const { rows } = await client.query(query);
      out[name] = rows.map((r) => String(r.line).replace(/\s+/g, ' ').trim());
    } catch (err) {
      out[name] = [`<probe failed: ${err.message}>`];
    }
  }
  await client.end();
  return out;
}

const [ref, cand] = await Promise.all([probe(REFERENCE), probe(CANDIDATE)]);

let problems = 0;
for (const name of Object.keys(PROBES)) {
  const a = ref[name] ?? [];
  const b = cand[name] ?? [];
  const setA = new Set(a);
  const setB = new Set(b);
  const missing = a.filter((x) => !setB.has(x));
  const extra = b.filter((x) => !setA.has(x));

  if (!missing.length && !extra.length) {
    console.log(`  ok        ${name.padEnd(14)} ${a.length}`);
    continue;
  }
  problems += missing.length + extra.length;
  console.log(`  MISMATCH  ${name}  (reference ${a.length} / models ${b.length})`);
  for (const line of missing.slice(0, 6)) console.log(`    - lost   : ${line.slice(0, 170)}`);
  for (const line of extra.slice(0, 6)) console.log(`    + gained : ${line.slice(0, 170)}`);
}

if (problems) {
  console.error(`\n[verify] ${problems} difference(s). Do NOT retire db/legacy.`);
  process.exit(1);
}
console.log('\n[verify] identical — the models reproduce the legacy schema exactly.');
