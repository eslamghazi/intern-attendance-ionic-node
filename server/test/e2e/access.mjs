// An admin's reach — domain/access/scope.ts applied at the six surfaces that
// bypass RLS entirely, plus the self-service profile endpoints.
//
// Every one of these was unguarded: an admin assigned to one branch could
// act on the whole faculty, because the rule lived in SQL and these requests
// run as the service role.

import {
  SUPERADMIN,
  call,
  check,
  login,
  psql,
  report,
} from './harness.mjs';

/* ------------------------------------------------------------------ fixtures */
psql(`delete from public.profiles where role <> 'superadmin'`);
psql(`delete from public.branches`);
psql(`delete from public.groups`);
psql(`delete from public.institutions`);
psql(`insert into public.institutions (name, code) values ('Test Institution', 1)`);
const inst = psql(`select id from public.institutions limit 1`);
psql(`insert into public.branches (name, institution_id, latitude, longitude, qr_enabled)
      values ('Branch A','${inst}',31.0,30.0,true),('Branch B','${inst}',31.1,30.1,true)`);
const branchA = psql(`select id from public.branches where name='Branch A'`);
const branchB = psql(`select id from public.branches where name='Branch B'`);
psql(`insert into public.groups (name, year, institution_id, branch_id) values ('Group B',2026,'${inst}','${branchB}')`);
const groupB = psql(`select id from public.groups where name='Group B'`);
psql(`update public.app_settings set checkin_method = 'qr' where id = 1`);

const su = await login(SUPERADMIN.nationalId, SUPERADMIN.password);
const suToken = su.body.access_token;

// One admin assigned to Branch A only, one with no assignments at all.
const assigned = await call('POST', '/auth/staff', {
  token: suToken,
  body: {
    national_id: '29505151234561', full_name: 'Assigned Admin', role: 'admin',
    assignments: [{ branch_id: branchA }],
  },
});
const wide = await call('POST', '/auth/staff', {
  token: suToken,
  body: { national_id: '29606161234562', full_name: 'Unassigned Admin', role: 'admin' },
});
check('created the assigned admin', assigned.status, 201);
check('created the unassigned admin', wide.status, 201);

const aTok = (await login('29505151234561', assigned.body.password)).body.access_token;
const wTok = (await login('29606161234562', wide.body.password)).body.access_token;

// A member on shift in Branch B, so a spot-check there has a target.
psql(`insert into public.profiles (role, full_name, national_id) values ('member','B Member','30303031234565')`);
const bProfile = psql(`select id from public.profiles where national_id='30303031234565'`);
psql(`insert into public.members (profile_id, group_id, branch_id) values ('${bProfile}','${groupB}','${branchB}')`);
const bMember = psql(`select id from public.members where profile_id='${bProfile}'`);
const today = psql(`select (now() at time zone 'Africa/Cairo')::date`);
psql(`insert into public.attendance (member_id, date, branch_id, check_in_at, status) values ('${bMember}','${today}','${branchB}', now(), 'present')`);

console.log('\n--- spot-check: POST /presence/checks (service role, no RLS) ---');
const ownBranch = await call('POST', '/presence/checks', {
  token: aTok, body: { branch_id: branchA, deadline_minutes: 10 },
});
// Nobody is on shift in Branch A, so 422 — but it got PAST the scope check,
// which is what this asserts.
check('assigned admin reaches their own branch', ownBranch.status, 422);

const otherBranch = await call('POST', '/presence/checks', {
  token: aTok, body: { branch_id: branchB, deadline_minutes: 10 },
});
check('assigned admin CANNOT reach another branch', otherBranch.status, 403);
console.log(`       ${JSON.stringify(otherBranch.body?.error?.message ?? null)}`);

const noFilter = await call('POST', '/presence/checks', {
  token: aTok, body: { deadline_minutes: 10 },
});
check('...nor ask for everyone by omitting the filter', noFilter.status, 403);

const wideOther = await call('POST', '/presence/checks', {
  token: wTok, body: { branch_id: branchB, deadline_minutes: 10 },
});
check('an UNASSIGNED admin still reaches everything', wideOther.status, 201);

const suAll = await call('POST', '/presence/checks', {
  token: suToken, body: { deadline_minutes: 10 },
});
check('a superadmin may ask for everyone', suAll.status, 201);

console.log('\n--- QR: POST /qr (service role, no RLS) ---');
const qrOwn = await call('POST', '/qr', { token: aTok, body: { branch_id: branchA, date: today } });
check('assigned admin mints for their own branch', qrOwn.status < 400, true);
const qrOther = await call('POST', '/qr', { token: aTok, body: { branch_id: branchB, date: today } });
check('assigned admin CANNOT mint for another branch', qrOther.status, 403);
const qrWide = await call('POST', '/qr', { token: wTok, body: { branch_id: branchB, date: today } });
check('an unassigned admin can', qrWide.status < 400, true);

console.log('\n--- manual attendance: POST /attendance/set (service role, no RLS) ---');
const setOther = await call('POST', '/attendance/set', {
  token: aTok, body: { member_id: bMember, date: today, status: 'absent' },
});
check('assigned admin CANNOT set another branch\'s member', setOther.status, 404);
const clearOther = await call('POST', '/attendance/set', {
  token: aTok, body: { member_id: bMember, date: today, clear: true },
});
check('...nor clear their record', clearOther.status, 404);
check('  the record is untouched', psql(`select count(*) from public.attendance where member_id='${bMember}'`), '1');

const setWide = await call('POST', '/attendance/set', {
  token: wTok, body: { member_id: bMember, date: today, status: 'absent' },
});
check('an unassigned admin can', setWide.status, 200);

console.log('\n--- roster upload: POST /members (service role, no RLS) ---');
psql(`insert into public.groups (name, year, institution_id, branch_id) values ('Group A',2026,'${inst}','${branchA}')`);
const groupA = psql(`select id from public.groups where name='Group A'`);
const mine = await call('POST', '/members', {
  token: aTok,
  body: { national_id: '30505051234567', full_name: 'Mine', group_id: groupA, branch_id: branchA },
});
check('assigned admin uploads into their own branch', mine.body?.created, 1);
const theirs = await call('POST', '/members', {
  token: aTok,
  body: { national_id: '30606061234568', full_name: 'Theirs', group_id: groupB, branch_id: branchB },
});
check('assigned admin CANNOT upload into another branch', theirs.body?.created, 0);
check('  and the row is reported, not silently dropped', theirs.body?.results?.[0]?.ok, false);
check('  nobody was created', psql(`select count(*) from public.profiles where national_id='30606061234568'`), '0');
const wideUpload = await call('POST', '/members', {
  token: wTok,
  body: { national_id: '30606061234568', full_name: 'Theirs', group_id: groupB, branch_id: branchB },
});
check('an unassigned admin can', wideUpload.body?.created, 1);

console.log('\n--- face enrolment: clearing someone else\'s ---');
psql(`insert into public.face_templates (member_id, embedding) values ('${bMember}', array_fill(0.1::real, array[512])::vector)`);
check('B member is enrolled', psql(`select count(*) from public.face_templates where member_id='${bMember}'`), '1');
check('assigned admin CANNOT reset another branch\'s face', (await call('POST', '/face/reset', { token: aTok, body: { member_id: bMember } })).status, 404);
check('...nor through the face tool', (await call('POST', '/face/tool-reset', { token: aTok, body: { member_id: bMember } })).status, 404);
check('  the enrolment survives', psql(`select count(*) from public.face_templates where member_id='${bMember}'`), '1');
check('an unassigned admin can', (await call('POST', '/face/reset', { token: wTok, body: { member_id: bMember } })).status, 200);
check('  and it is cleared', psql(`select count(*) from public.face_templates where member_id='${bMember}'`), '0');

console.log('\n--- profile self-service (the three retired functions) ---');
psql(`insert into public.profiles (role, full_name, national_id) values ('member','Self Member','30404041234566')`);
const selfTok = (await login('30404041234566', '30404041234566')).body.access_token;
const selfId = psql(`select id from public.profiles where national_id='30404041234566'`);
psql(`insert into public.members (profile_id, group_id, branch_id) values ('${selfId}','${groupB}','${branchA}')`);

check('mark-password-changed', (await call('POST', '/profile/mark-password-changed', { token: selfTok })).status, 200);
check('  the flag is cleared', psql(`select must_change_password from public.profiles where id='${selfId}'`), 'f');
check('mark-enrolled', (await call('POST', '/profile/mark-enrolled', { token: selfTok })).status, 200);
check('  the member is enrolled', psql(`select enrollment_status from public.members where profile_id='${selfId}'`), 'enrolled');

const edit = await call('PATCH', '/profile/me', {
  token: selfTok,
  body: { full_name: 'Renamed', phone: '01000000000', email: 'x@y.z', national_id: '30404041234566' },
});
check('edit own profile', edit.status, 200);
check('  name changed', psql(`select full_name from public.profiles where id='${selfId}'`), 'Renamed');
check('  phone set', psql(`select phone from public.profiles where id='${selfId}'`), '01000000000');

// A blank name never reaches the service: the route's schema requires min(1),
// so the `coalesce(nullif(...))` on full_name is unreachable through the API.
const blankName = await call('PATCH', '/profile/me', {
  token: selfTok,
  body: { full_name: '', phone: '', email: '', national_id: '30404041234566' },
});
check('a blank name is rejected by the route schema', blankName.status, 400);

const blank = await call('PATCH', '/profile/me', {
  token: selfTok,
  body: { full_name: 'Renamed', phone: '', email: '', national_id: '30404041234566' },
});
check('a blank phone clears it', blank.status, 200);
check('  name kept', psql(`select full_name from public.profiles where id='${selfId}'`), 'Renamed');
check('  phone cleared', psql(`select coalesce(phone,'<null>') from public.profiles where id='${selfId}'`), '<null>');

const dupe = await call('PATCH', '/profile/me', {
  token: selfTok,
  body: { full_name: 'Renamed', phone: '', email: '', national_id: '30303031234565' },
});
check('taking someone else\'s national id is refused', dupe.status, 409);
check('  with the code the client reads', dupe.body?.error?.code, 'national_id_taken');

// The guarantee the column list exists for.
const escalate = await call('PATCH', '/profile/me', {
  token: selfTok,
  body: { full_name: 'Renamed', phone: '', email: '', national_id: '30404041234566', role: 'superadmin' },
});
check('a member cannot promote themselves', escalate.status, 200);
check('  still a member', psql(`select role from public.profiles where id='${selfId}'`), 'member');

process.exit(report() ? 0 : 1);
