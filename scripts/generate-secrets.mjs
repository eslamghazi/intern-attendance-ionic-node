// Generate the secrets a deployment needs, ready to paste into .env.
//
//   node scripts/generate-secrets.mjs
//
// Three separate values, deliberately. Reusing one across all three means a
// leak anywhere is a leak everywhere: the database password reaching a log
// would also forge sessions, and a signed image URL copied out of a browser
// would be a step towards one.
//
// Prints to stdout and writes nothing. Piping it into a file is your choice to
// make, not this script's — see the note at the end.
import { randomBytes } from 'node:crypto';

/** 32 bytes. Long enough that guessing is not a strategy, short enough to paste. */
const secret = () => randomBytes(32).toString('base64url');

/**
 * The database password goes into a connection URL, so it must survive being
 * one — a `/`, `@`, `:` or `#` in a password silently truncates the URL and
 * produces a connection failure nobody reads as "bad password".
 */
const dbPassword = () => randomBytes(24).toString('base64url');

const values = {
  APP_JWT_SECRET: secret(),
  STORAGE_URL_SECRET: secret(),
  POSTGRES_PASSWORD: dbPassword(),
};

console.log(`
# ---------------------------------------------------------------------------
# Generated ${new Date().toISOString()}
#
# APP_JWT_SECRET       signs the access tokens. Changing it signs EVERYONE out
#                      at once — refresh tokens survive (they live in the
#                      database), so the apps recover on their next renewal.
# STORAGE_URL_SECRET   signs the image URLs. Separate from the one above on
#                      purpose: a leaked photo link must never be a step
#                      towards forging a session.
# POSTGRES_PASSWORD    only ever used inside the Docker network. Postgres is
#                      not published on a public interface — see
#                      docker-compose.prod.yml.
# ---------------------------------------------------------------------------
${Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n')}
`);

console.error(
  [
    'Copy these into .env by hand rather than redirecting this script into it:',
    '  * a redirect would overwrite the file, taking the settings already in it;',
    '  * and it would put the secrets in your shell history.',
    '',
    'Rotating later: APP_JWT_SECRET and STORAGE_URL_SECRET can be changed at any',
    'time (sessions renew, image URLs are re-minted on the next page load).',
    'POSTGRES_PASSWORD needs the database user altered to match, so change that',
    'one deliberately, not casually.',
  ].join('\n'),
);
