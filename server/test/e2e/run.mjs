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
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Set BEFORE importing the harness: it reads API_BASE at module load, and an
// `API_BASE=… node …` prefix is not portable to Windows, where these are also
// run. A flag works the same everywhere.
if (process.argv.includes('--prod') && !process.env.API_BASE) {
  process.env.API_BASE = 'http://127.0.0.1:8080/api/v1';
}

// --local runs the suites against a Postgres and an API on this machine, with
// no containers. Set before the harness loads, which reads it at module scope.
if (process.argv.includes('--local')) process.env.E2E_LOCAL = '1';
const LOCAL = process.env.E2E_LOCAL === '1';

const { BASE, reset, onLocalRestart, waitForHealth } = await import('./harness.mjs');

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = resolve(HERE, '../..');

/** What the suites sign in with. Set on the seeded account before they run. */
const E2E_PASSWORD = process.env.E2E_SUPERADMIN_PW || 'SuperTest!2026';

/**
 * The API, when this runner is the one running it.
 *
 * In Docker mode the stack is already up and reset() restarts a container.
 * Locally there is no supervisor, so this file is it: the suites run as their
 * own processes and none of them can hold the handle.
 */
let api = null;

function startApi() {
  return new Promise((ready, fail) => {
    api = spawn(process.execPath, [join(SERVER_ROOT, 'dist/main.js')], {
      cwd: SERVER_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // Kept, not printed: a passing run should not bury its own output under
    // Nest's route table. On a failure this is what says why it would not
    // start, which is otherwise invisible.
    let log = '';
    const keep = (chunk) => {
      log += chunk;
      if (log.length > 20000) log = log.slice(-20000);
    };
    api.stdout.on('data', keep);
    api.stderr.on('data', keep);
    api.on('exit', (code) => {
      if (code) {
        console.error('\n[api] exited with ' + code + ':\n' + log);
        fail(new Error('the API exited with ' + code));
      }
    });
    waitForHealth().then(ready, (err) => {
      console.error('\n[api] never became healthy:\n' + log);
      fail(err);
    });
  });
}

async function stopApi() {
  if (!api) return;
  const dying = api;
  api = null;
  await new Promise((done) => {
    dying.once('exit', done);
    dying.kill();
    setTimeout(done, 5000).unref();
  });
}

if (LOCAL) {
  // The rate limiter and every other piece of in-memory state lives in the API
  // process, so a reset means a new one — which is what `docker compose restart
  // api` buys in the other mode.
  onLocalRestart(async () => {
    await stopApi();
    await startApi();
  });
  await startApi();
  process.on('exit', () => api && api.kill());

  // THE API CREATED THE SUPERADMIN, AND ONLY IT KNOWS THE PASSWORD.
  //
  // The first account is seeded at boot with generated credentials — there is
  // no environment to read them from any more. Rather than scrape the console
  // or the credentials file, set a known password now, with the same tool an
  // operator would use. That also exercises it on every run.
  const set = spawnSync(
    process.execPath,
    [join(SERVER_ROOT, 'scripts/superadmin-password.mjs'), '--set', E2E_PASSWORD],
    { cwd: SERVER_ROOT, env: process.env, encoding: 'utf8' },
  );
  if (set.status !== 0) {
    console.error(set.stdout || '', set.stderr || '');
    throw new Error('could not set the superadmin password for the run');
  }
  process.env.E2E_SUPERADMIN_PW = E2E_PASSWORD;
}
// In Docker mode the stack is already running and reset() restarts it, so
// there is nothing here to start, stop or clean up.

// token first: if sign-in itself is broken, the other three fail for reasons
// that say nothing about what they test.
// guards last: it asserts the invariant the other four exercise case by case,
// so a failure there is most legible once they have all reported.
const SUITES = ['token', 'auth', 'storage', 'access', 'attendance', 'reports', 'guards'];

console.log(`\nEnd-to-end against ${BASE}\n${'='.repeat(60)}`);

const failed = [];

for (const name of SUITES) {
  console.log(`\n### ${name}`);
  try {
    await reset();
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

await stopApi();

console.log(`\n${'='.repeat(60)}`);
if (failed.length) {
  console.error(`FAILED: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`All ${SUITES.length} suites passed.`);
