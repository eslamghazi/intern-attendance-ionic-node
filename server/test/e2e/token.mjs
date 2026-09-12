// Access and refresh tokens: rotation, revocation, and reuse detection.
//
// Sign-in used to hand out ONE token that lasted 30 days and could not be
// revoked. These checks are what proves the replacement actually revokes.

import {
  SUPERADMIN,
  call,
  check,
  login,
  psql,
  report,
} from './harness.mjs';

/** Read a JWT's payload. Not verified — these checks are about its CONTENTS:
 *  the lifetime, and the claim set the guards read. */
const decode = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());

console.log('\n--- sign-in hands out a pair ---');
const first = await login(SUPERADMIN.nationalId, SUPERADMIN.password);
check('login', first.status, 200);
check('  has an access token', typeof first.body?.access_token, 'string');
check('  has a refresh token', typeof first.body?.refresh_token, 'string');
check('  says how long it lives', first.body?.expires_in, 900);
check('  token_type', first.body?.token_type, 'Bearer');

const claims = decode(first.body.access_token);
const lifetime = claims.exp - claims.iat;
check('access token lives 15 minutes, not 30 days', lifetime, 900);
console.log(`       exp - iat = ${lifetime}s (was ${30 * 24 * 3600}s)`);
// The claim set is the API's own now. It used to be copied verbatim into
// request.jwt.claims for every query, so `aud` carried the hosted auth
// service's fixed audience and a second `role` claim named a Postgres role to
// SET ROLE into. Neither the GUC nor the role switch exists any more.
check('the audience is this application', claims.aud, 'intern-attendance');
check('  the role the guard reads is present', claims.user_role, 'superadmin');
check('  and no Postgres role is named in the token', claims.role, undefined);

console.log('\n--- the refresh token is opaque and stored hashed ---');
check('not a JWT', first.body.refresh_token.includes('.'), false);
check('stored as a 64-char sha256', psql(`select length(token_hash) from public.refresh_tokens order by issued_at desc limit 1`), '64');
check('the raw token is nowhere in the table',
  psql(`select count(*) from public.refresh_tokens where token_hash = '${first.body.refresh_token}'`), '0');

console.log('\n--- rotation ---');
const second = await call('POST', '/auth/refresh', { body: { refresh_token: first.body.refresh_token } });
check('refresh returns a new pair', second.status, 200);
check('  the refresh token changed', second.body.refresh_token !== first.body.refresh_token, true);
check('  the new access token works', (await call('GET', '/auth/me', { token: second.body.access_token })).status, 200);
check('  the old one is marked rotated',
  psql(`select count(*) from public.refresh_tokens where rotated_at is not null`), '1');
check('  both are in ONE family',
  psql(`select count(distinct family_id) from public.refresh_tokens`), '1');

console.log('\n--- reuse detection: the point of rotating ---');
const replay = await call('POST', '/auth/refresh', { body: { refresh_token: first.body.refresh_token } });
check('replaying the old token is refused', replay.status, 401);
check('  and the WHOLE family is revoked',
  psql(`select count(*) from public.refresh_tokens where revoked_at is null`), '0');
const afterReuse = await call('POST', '/auth/refresh', { body: { refresh_token: second.body.refresh_token } });
check('  so the thief\'s current token dies too', afterReuse.status, 401);
check('  it is recorded in the audit log',
  psql(`select count(*) from public.audit_log where detail->>'event' = 'refresh_token_reuse'`), '1');

console.log('\n--- an unknown or malformed token ---');
check('garbage', (await call('POST', '/auth/refresh', { body: { refresh_token: 'nope' } })).status, 401);
check('missing', (await call('POST', '/auth/refresh', { body: {} })).status, 400);

console.log('\n--- logout revokes, it does not just forget ---');
psql(`delete from public.refresh_tokens`);
const s3 = await login(SUPERADMIN.nationalId, SUPERADMIN.password);
check('signed in again', s3.status, 200);
check('logout', (await call('POST', '/auth/logout', { body: { refresh_token: s3.body.refresh_token } })).status, 200);
check('  the refresh token no longer works',
  (await call('POST', '/auth/refresh', { body: { refresh_token: s3.body.refresh_token } })).status, 401);
check('  the row is revoked, not deleted',
  psql(`select count(*) from public.refresh_tokens where revoked_at is not null`), '1');

console.log('\n--- sign out everywhere ---');
psql(`delete from public.refresh_tokens`);
const phone = await login(SUPERADMIN.nationalId, SUPERADMIN.password);
const laptop = await login(SUPERADMIN.nationalId, SUPERADMIN.password);
check('two devices, two families',
  psql(`select count(distinct family_id) from public.refresh_tokens`), '2');
const all = await call('POST', '/auth/logout-all', { token: phone.body.access_token });
check('logout-all', all.status, 200);
check('  revoked both', all.body?.revoked, 2);
check('  the laptop cannot refresh either',
  (await call('POST', '/auth/refresh', { body: { refresh_token: laptop.body.refresh_token } })).status, 401);

console.log('\n--- changing a password ends every other session ---');
psql(`delete from public.refresh_tokens`);
const a = await login(SUPERADMIN.nationalId, SUPERADMIN.password);
const b = await login(SUPERADMIN.nationalId, SUPERADMIN.password);
const changed = await call('POST', '/auth/password', {
  token: a.body.access_token, body: { current: SUPERADMIN.password, new: 'SuperTest!2027' },
});
check('password changed', changed.status, 200);
check('  the caller gets a fresh pair', typeof changed.body?.refresh_token, 'string');
check('  and it works', (await call('POST', '/auth/refresh', { body: { refresh_token: changed.body.refresh_token } })).status, 200);
check('  the OTHER session is gone',
  (await call('POST', '/auth/refresh', { body: { refresh_token: b.body.refresh_token } })).status, 401);
check('  the old password no longer signs in', (await login(SUPERADMIN.nationalId, SUPERADMIN.password)).status, 401);
// Put it back so the other suites keep working.
const restore = await login(SUPERADMIN.nationalId, 'SuperTest!2027');
await call('POST', '/auth/password', {
  token: restore.body.access_token, body: { current: 'SuperTest!2027', new: SUPERADMIN.password },
});
check('restored for the other suites', (await login(SUPERADMIN.nationalId, SUPERADMIN.password)).status, 200);

console.log('\n--- a deactivated account cannot renew ---');
psql(`delete from public.refresh_tokens`);
const doomed = await login(SUPERADMIN.nationalId, SUPERADMIN.password);
psql(`update public.profiles set is_active = false where national_id = '${SUPERADMIN.nationalId}'`);
check('refresh is refused once deactivated',
  (await call('POST', '/auth/refresh', { body: { refresh_token: doomed.body.refresh_token } })).status, 401);
psql(`update public.profiles set is_active = true where national_id = '${SUPERADMIN.nationalId}'`);

process.exit(report() ? 0 : 1);
