// Run every end-to-end suite in order, against a running stack.
//
//   npm run test:e2e          the dev stack, API on :8787
//   npm run test:e2e:prod     the prod stack, through nginx on :8080
//
// The suites are run as separate processes rather than imported, because each
// one ends by calling process.exit() with its own verdict — and because a
// failure in one must not stop the others from reporting.
//
// They run SEQUENTIALLY and reset between. They share one database and one
// superadmin, so running them together would have them deleting each other's
// fixtures; and the sign-in rate limiter is per national id, so the shared
// superadmin would start returning 429 partway through.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Set BEFORE importing the harness: it reads API_BASE at module load, and an
// `API_BASE=… node …` prefix is not portable to Windows, where these are also
// run. A flag works the same everywhere.
if (process.argv.includes('--prod') && !process.env.API_BASE) {
  process.env.API_BASE = 'http://127.0.0.1:8080/api/v1';
}

const { BASE, reset } = await import('./harness.mjs');

const HERE = dirname(fileURLToPath(import.meta.url));

// token first: if sign-in itself is broken, the other three fail for reasons
// that say nothing about what they test.
// guards last: it asserts the invariant the other four exercise case by case,
// so a failure there is most legible once they have all reported.
const SUITES = ['token', 'auth', 'storage', 'access', 'guards'];

console.log(`\nEnd-to-end against ${BASE}\n${'='.repeat(60)}`);

const failed = [];

for (const name of SUITES) {
  console.log(`\n### ${name}`);
  try {
    reset();
  } catch (err) {
    console.error(`  could not reset before ${name}: ${err.message}`);
    failed.push(name);
    continue;
  }

  const result = spawnSync(process.execPath, [join(HERE, `${name}.mjs`)], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) failed.push(name);
}

console.log(`\n${'='.repeat(60)}`);
if (failed.length) {
  console.error(`FAILED: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`All ${SUITES.length} suites passed.`);
