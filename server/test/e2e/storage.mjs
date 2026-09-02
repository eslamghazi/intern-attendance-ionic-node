// Storage after the move off storage.objects onto public.attachments.
//
// The point of this file is the isolation checks: a member must not reach
// another member's face or probe. It also follows the signed URLs to the
// bytes, which is how the missing download route was found.

import {
  ORIGIN,
  SUPERADMIN,
  call,
  check,
  login,
  psql,
  report,
} from './harness.mjs';

// Two members, so "can A see B's face?" has a real answer.
// Dropped and recreated, not upserted: a member left over from an earlier run
// already has a password, and these two sign in with their national id.
for (const [nid, name] of [['30101011234563', 'Member A'], ['30202021234564', 'Member B']]) {
  psql(`delete from public.profiles where national_id = '${nid}'`);
  psql(`insert into public.profiles (role, full_name, national_id) values ('member','${name}','${nid}')`);
}
const A_NID = '30101011234563', B_NID = '30202021234564';

const su = await login(SUPERADMIN.nationalId, SUPERADMIN.password);
const suToken = su.body.access_token;
const a = await login(A_NID, A_NID);
const b = await login(B_NID, B_NID);
const aToken = a.body.access_token, bToken = b.body.access_token;
const aId = a.body.profile.id, bId = b.body.profile.id;
check('member A signed in', a.status, 200);
check('member B signed in', b.status, 200);

// A 1x1 jpeg, enough to prove bytes survive the round trip.
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);
const b64 = JPEG.toString('base64');

console.log('\n--- upload: your own folder, and nobody else\'s ---');
const own = await call('POST', '/storage/faces', {
  token: aToken, body: { path: `${aId}/face.jpg`, content_base64: b64, content_type: 'image/jpeg' },
});
check('A uploads into their own folder', own.status, 201);

const foreign = await call('POST', '/storage/faces', {
  token: aToken, body: { path: `${bId}/face.jpg`, content_base64: b64, content_type: 'image/jpeg' },
});
check('A CANNOT upload into B\'s folder', foreign.status >= 400, true);
console.log(`       refused with ${foreign.status} ${JSON.stringify(foreign.body?.error?.code ?? null)}`);

const flat = await call('POST', '/storage/faces', {
  token: aToken, body: { path: 'face.jpg', content_base64: b64, content_type: 'image/jpeg' },
});
check('a path with no folder is refused', flat.status, 403);

console.log('\n--- signed urls: visibility is the policy\'s answer ---');
const aOwn = await call('GET', `/storage/faces/url?path=${encodeURIComponent(aId + '/face.jpg')}`, { token: aToken });
check('A gets a URL for their own face', aOwn.status, 200);
check('  and it is signed', /signature=/.test(aOwn.body?.url ?? ''), true);

const bPeek = await call('GET', `/storage/faces/url?path=${encodeURIComponent(aId + '/face.jpg')}`, { token: bToken });
check('B CANNOT get a URL for A\'s face', bPeek.status, 404);

const adminPeek = await call('GET', `/storage/faces/url?path=${encodeURIComponent(aId + '/face.jpg')}`, { token: suToken });
check('an admin can', adminPeek.status, 200);

const batch = await call('POST', '/storage/faces/urls', {
  token: bToken, body: { paths: [`${aId}/face.jpg`] },
});
check('the batch endpoint hides it too', Object.keys(batch.body ?? {}).length, 0);

console.log('\n--- the bytes actually come back ---');
const signed = aOwn.body.url.replace('/api/v1', '');
const got = await call('GET', signed, { raw: true });
check('signed URL serves the file', got.status, 200);
check('  byte-for-byte', got.bytes.equals(JPEG), true);
check('  with the stored content type', got.headers.get('content-type'), 'image/jpeg');

const tampered = signed.replace(/expires=\d+/, 'expires=9999999999');
const bad = await call('GET', tampered, { raw: true });
check('a tampered expiry is rejected', bad.status, 404);
const expired = `/storage/faces/object?path=${encodeURIComponent(aId + '/face.jpg')}&expires=1&signature=${encodeURIComponent(new URL('http://x' + signed).searchParams.get('signature'))}`;
check('an expiry swapped for another is refused', (await call('GET', expired, { raw: true })).status, 404);
const noSig = `/storage/faces/object?path=${encodeURIComponent(aId + '/face.jpg')}`;
check('an unsigned request for a private file is refused', (await call('GET', noSig, { raw: true })).status, 404);

console.log('\n--- avatars are public, and need no token ---');
const av = await call('POST', '/storage/avatars', {
  token: aToken, body: { path: `${aId}.jpg`, content_base64: b64, content_type: 'image/jpeg' },
});
check('A uploads their own avatar', av.status, 201);
const avUrl = await call('GET', `/storage/avatars/url?path=${encodeURIComponent(aId + '.jpg')}`, { token: aToken });
check('avatar URL is unsigned', /signature=/.test(avUrl.body?.url ?? ''), false);
const anonAv = await fetch(ORIGIN + avUrl.body.url);
check('a signed-out caller can fetch it', anonAv.status, 200);

console.log('\n--- admin delete removes both halves ---');
const before = psql(`select count(*) from public.attachments where bucket='faces' and path='${aId}/face.jpg'`);
check('the row exists', before, '1');
const del = await call('DELETE', '/storage/faces', { token: suToken, body: { paths: [`${aId}/face.jpg`] } });
check('delete accepted', del.status, 200);
check('  the row is gone', psql(`select count(*) from public.attachments where bucket='faces' and path='${aId}/face.jpg'`), '0');
const goneUrl = await call('GET', `/storage/faces/url?path=${encodeURIComponent(aId + '/face.jpg')}`, { token: aToken });
check('  and no URL can be minted', goneUrl.status, 404);

process.exit(report() ? 0 : 1);
