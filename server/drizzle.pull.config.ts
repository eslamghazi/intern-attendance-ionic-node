// Config for `db:pull` ONLY.
//
// pull and generate both write to `out`, but they mean different things by it:
// generate writes the migrations that build the schema, pull writes a snapshot
// of a database that already exists. Pointing them at the same directory makes
// a pull look like a migration.
//
// So pull lands in a scratch directory, and scripts/patch-drizzle-output.mjs
// moves the model files into src/db/schema and throws the rest away.
//
// pull is a BOOTSTRAP, not part of the normal loop. The models are the source
// of truth; you pull only to adopt a database somebody else changed.
import base from './drizzle.config';

export default {
  ...base,
  out: './.drizzle-pull',
};
