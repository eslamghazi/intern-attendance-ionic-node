// Copy the image FILES out of Supabase Storage into this deployment's S3.
//
// Run this AFTER import-from-supabase.mjs. That script copies storage.objects —
// the metadata rows the bucket policies are evaluated against — but the bytes
// live in Supabase Storage, so the database would point at files that are not
// there: every enrolment photo and every check-in capture would 404.
//
// It works from storage.objects rather than by listing the remote buckets, so
// what gets copied is exactly what the database claims to have. A file present
// remotely but unknown to the database was already unreachable and stays that
// way; a row whose file is missing is reported, because that is a real gap in
// the record rather than something to paper over.
//
// Idempotent: an object already in the target is skipped, so an interrupted run
// resumes by re-running.
//
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=… \
//   DATABASE_URL=postgres://… \
//   S3_ENDPOINT=127.0.0.1 S3_ACCESS_KEY=… S3_SECRET_KEY=… \
//   node scripts/import-storage.mjs [--dry-run]
import { Client } from 'minio';
import pg from 'pg';
import 'dotenv/config';

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SERVICE_KEY || !process.env.DATABASE_URL) {
  console.error(
    '[storage] SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL are required.',
  );
  process.exit(1);
}

const s3 = new Client({
  endPoint: process.env.S3_ENDPOINT ?? '127.0.0.1',
  port: Number(process.env.S3_PORT ?? 9000),
  useSSL: process.env.S3_USE_SSL === '1',
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY,
});

/** Fetch one object from Supabase Storage. Returns null when it is not there. */
async function download(bucket, name) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(name)}`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function exists(bucket, name) {
  try {
    await s3.statObject(bucket, name);
    return true;
  } catch {
    return false;
  }
}

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});
await db.connect();

const { rows: buckets } = await db.query('select id, public from storage.buckets order by id');
for (const b of buckets) {
  if (!(await s3.bucketExists(b.id))) {
    if (dryRun) console.log(`[storage] would create bucket ${b.id}`);
    else await s3.makeBucket(b.id);
  }
}

const { rows: objects } = await db.query(
  `select bucket_id, name, coalesce(metadata->>'mimetype', 'application/octet-stream') as mime
     from storage.objects order by bucket_id, name`,
);
console.log(`[storage] ${objects.length} object(s) recorded in the database\n`);

let copied = 0;
let skipped = 0;
const missing = [];
let failed = 0;

// A handful at a time. A few hundred parallel downloads is how you get
// throttled by the storage API and end up with a half-copied set.
const POOL = 6;
const queue = [...objects];

await Promise.all(
  Array.from({ length: Math.min(POOL, queue.length) }, async () => {
    for (;;) {
      const o = queue.shift();
      if (!o) return;
      try {
        if (await exists(o.bucket_id, o.name)) {
          skipped++;
          continue;
        }
        if (dryRun) {
          copied++;
          continue;
        }
        const body = await download(o.bucket_id, o.name);
        if (!body) {
          missing.push(`${o.bucket_id}/${o.name}`);
          continue;
        }
        await s3.putObject(o.bucket_id, o.name, body, body.length, {
          'Content-Type': o.mime,
        });
        copied++;
        if (copied % 50 === 0) process.stdout.write(`  copied ${copied}…\n`);
      } catch (err) {
        failed++;
        console.error(`  FAILED ${o.bucket_id}/${o.name}: ${err.message}`);
      }
    }
  }),
);

console.log(
  `\n[storage] ${dryRun ? 'would copy' : 'copied'} ${copied}, already present ${skipped}, ` +
    `missing at source ${missing.length}, failed ${failed}`,
);

if (missing.length) {
  // Not fatal: the row records that a photo was taken, and the app already
  // handles a signed URL that resolves to nothing. But it IS data loss, so it
  // is named rather than counted.
  console.log('\n[storage] recorded in the database but absent from Supabase Storage:');
  for (const m of missing.slice(0, 40)) console.log(`  ${m}`);
  if (missing.length > 40) console.log(`  … and ${missing.length - 40} more`);
}

await db.end();
if (failed) {
  console.error('\n[storage] some objects failed. Re-run to retry only those.');
  process.exit(1);
}
