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

console.log('\n--- the master password hash must never leave the server ---');
// AUDIT 2.1. GET /settings ran `select *` under the caller, and the governing
// policy is `settings_select ... to authenticated using (true)` — so every
// column came back, including the bcrypt hash of the SHARED master password
// that opens every member and admin account.
psql(`update public.app_settings set master_password_hash = crypt('AuditMaster!2026', gen_salt('bf')) where id = 1`);
const settingsAsMember = await call('GET', '/settings', { token: selfTok });
check('a member can read /settings', settingsAsMember.status, 200);
check('  but NOT the master password hash',
  settingsAsMember.body?.master_password_hash, undefined);
check('  nor any other column carrying a secret',
  Object.keys(settingsAsMember.body ?? {}).some((k) => /password|secret|hash/i.test(k)), false);
// The settings the app actually needs must still be there, or the fix broke it.
check('  the settings the app needs are still returned',
  typeof settingsAsMember.body?.face_match_threshold, 'number');
check('  and so is the check-in method', typeof settingsAsMember.body?.checkin_method, 'string');
// An admin is no more entitled to it than a member: only the API itself,
// through verify/set, ever needs the hash.
const suSettings = await call('GET', '/settings', { token: suToken });
check('a superadmin cannot read it either', suSettings.body?.master_password_hash, undefined);
check('  though they can still ask WHETHER one is set',
  (await call('GET', '/settings/master-password', { token: suToken })).body?.configured, true);
// And the master password must still WORK, or the move broke sign-in.
check('the master password still opens an admin',
  (await login('29505151234561', 'AuditMaster!2026')).status, 200);
psql(`update public.app_settings set master_password_hash = null where id = 1`);

console.log('\n--- roster days are scoped to the admin who owns the branch ---');
// AUDIT 2.2. POST/DELETE /roster/days took member_id straight from the body and
// relied on `roster_days_write_admin`, which was plain is_admin() — unscoped.
// DELETE cascades through sync_attendance_with_roster, so an out-of-scope admin
// could silently destroy another branch's ATTENDANCE, not just its roster.
psql(`insert into public.shifts (name, start_time, end_time)
      select 'Audit Shift', '08:00', '14:00'
       where not exists (select 1 from public.shifts where name = 'Audit Shift')`);
const shiftId = psql(`select id from public.shifts where name = 'Audit Shift'`);
const rosterDate = '2026-09-10';

const writeTheirs = await call('POST', '/roster/days', {
  token: aTok, body: { member_id: bMember, date: rosterDate, shift_id: shiftId },
});
check("assigned admin CANNOT roster another branch's member", writeTheirs.status, 404);
check('  and nothing was written',
  psql(`select count(*) from public.roster_days where member_id='${bMember}' and date='${rosterDate}'`), '0');

// Seed a roster day plus the attendance the trigger ties to it, then try to
// delete it from outside the scope. This is the destructive half.
psql(`insert into public.roster_days (member_id, date, shift_id)
      values ('${bMember}', '${rosterDate}', '${shiftId}')
      on conflict do nothing`);
psql(`insert into public.attendance (member_id, branch_id, date, shift_id, status, check_in_at)
      values ('${bMember}', '${branchB}', '${rosterDate}', '${shiftId}', 'present', now())
      on conflict (member_id, date, shift_id) do nothing`);
check('  a Branch B attendance record exists',
  psql(`select count(*) from public.attendance where member_id='${bMember}' and date='${rosterDate}'`), '1');

const deleteTheirs = await call('DELETE', '/roster/days', {
  token: aTok, body: { member_id: bMember, date: rosterDate, shift_id: shiftId },
});
check('assigned admin CANNOT un-roster them', deleteTheirs.status, 404);
check('  the roster day survives',
  psql(`select count(*) from public.roster_days where member_id='${bMember}' and date='${rosterDate}'`), '1');
check('  and so does the ATTENDANCE record',
  psql(`select count(*) from public.attendance where member_id='${bMember}' and date='${rosterDate}'`), '1');

// The admin who does own the branch is unaffected.
const ownRoster = await call('POST', '/roster/days', {
  token: wTok, body: { member_id: bMember, date: '2026-09-11', shift_id: shiftId },
});
check('an unassigned admin still can', ownRoster.status, 200);
check('  and can remove it again',
  (await call('DELETE', '/roster/days', {
    token: wTok, body: { member_id: bMember, date: '2026-09-11', shift_id: shiftId },
  })).status, 204);

console.log('\n--- a member record belongs to the branch that runs it ---');
// AUDIT 3.1. profiles_update_member_by_admin and profiles_delete_member_by_admin
// were `role = 'member' AND is_admin()` — no scope at all. The members table was
// already scoped, so PATCH /members/:id updated the member half correctly and
// the PROFILE half regardless of branch, in one transaction.
const editTheirs = await call('PATCH', `/members/${bMember}`, {
  token: aTok, body: { full_name: 'Renamed By Outsider' },
});
check("assigned admin CANNOT edit another branch's member", editTheirs.status >= 400, true);
check('  the name is unchanged',
  psql(`select full_name from public.profiles where id='${bProfile}'`), 'B Member');

// The national id is the login identifier AND, for a member who has never set a
// password, the password. Editing it across scope is account takeover.
const stealId = await call('PATCH', `/members/${bMember}`, {
  token: aTok, body: { national_id: '30909091234569' },
});
check('  nor rewrite their national id', stealId.status >= 400, true);
check('  it is unchanged',
  psql(`select national_id from public.profiles where id='${bProfile}'`), '30303031234565');

// The destructive one: deleting the profile cascades to the member row, their
// attendance, and their face template.
const delTheirs = await call('DELETE', `/members/by-profile/${bProfile}`, { token: aTok });
check('  nor delete their record entirely', delTheirs.status >= 400, true);
check('  the member still exists',
  psql(`select count(*) from public.profiles where id='${bProfile}'`), '1');

console.log('\n--- departments belong to a branch too ---');
// AUDIT 3.1. departments_write_admin was is_admin(); departments carry branch_id.
const deptTheirs = await call('PUT', '/departments', {
  token: aTok, body: { name: 'Ward X', branch_id: branchB },
});
check("assigned admin CANNOT create a department in another branch", deptTheirs.status >= 400, true);
check('  nothing was created',
  psql(`select count(*) from public.departments where branch_id='${branchB}'`), '0');

const deptOwn = await call('PUT', '/departments', {
  token: aTok, body: { name: 'Ward A', branch_id: branchA },
});
check('  but can in their own', deptOwn.status < 400, true);

console.log('\n--- the audit log is not client-writable ---');
// AUDIT 3.2. audit_insert_self allowed any authenticated caller to insert rows
// attributed to themselves OR to nobody (actor_id IS NULL). This table records
// mock_location_detected, face_mismatch, master_login and refresh-token reuse —
// the evidence trail for exactly the behaviour someone would want to bury.
const auditBefore = psql(`select count(*) from public.audit_log`);
const forged = psql(
  `insert into public.audit_log (actor_id, event, detail)
   select null, 'check_in', '{"forged":true}'::jsonb
    where pg_catalog.has_table_privilege('authenticated', 'public.audit_log', 'INSERT')`,
);
check('authenticated has no INSERT grant on audit_log',
  psql(`select has_table_privilege('authenticated', 'public.audit_log', 'INSERT')::text`), 'false');
check('  and no insert policy remains',
  psql(`select count(*) from pg_policies where tablename='audit_log' and cmd='INSERT'`), '0');
check('  nothing was forged', psql(`select count(*) from public.audit_log`), auditBefore);
// The API still writes them — it runs as the owner, which bypasses both.
check('  the API can still record events',
  psql(`select count(*) > 0 from public.audit_log where event = 'password_changed'`) !== '',
  true);

console.log('\n--- the API refuses on its own, without leaning on RLS ---');
// Five route files used to carry NO role check and rely entirely on the
// policies — catalog.ts said so in its own header. That worked, but it meant
// the API could not survive RLS being turned off: any signed-in student could
// have created a branch or deleted a shift.
//
// A 403 here is the API refusing. An empty list or a 404 would be RLS refusing,
// which is what these checks exist to tell apart — so they assert the status,
// not the absence of data.
const asMember = { token: selfTok };

check('a member cannot create a branch',
  (await call('POST', '/branches', { ...asMember, body: { name: 'Rogue', latitude: 31, longitude: 30, radius_meters: 100 } })).status, 403);
check('  nor delete a shift',
  (await call('DELETE', `/shifts/${shiftId}`, asMember)).status, 403);
check('  nor create an institution',
  (await call('POST', '/institutions', { ...asMember, body: { name: 'Rogue U', code: 99 } })).status, 403);
check('  nor edit a group',
  (await call('PATCH', `/groups/${groupB}`, { ...asMember, body: { name: 'Renamed', year: 2026 } })).status, 403);

check('a member cannot list staff',
  (await call('GET', '/admins', asMember)).status, 403);
check('  nor change a staff account',
  (await call('PATCH', `/admins/${bProfile}`, { ...asMember, body: { full_name: 'x' } })).status, 403);
check('  nor grant themselves an assignment',
  (await call('POST', '/admins/assignments', { ...asMember, body: { admin_id: selfId, branch_id: branchA } })).status, 403);

check('a member cannot create a department',
  (await call('PUT', '/departments', { ...asMember, body: { name: 'Rogue Ward', branch_id: branchA } })).status, 403);
check('  nor reassign members to one',
  (await call('PUT', '/member-departments', { ...asMember, body: { year: 2026, month: 9, assignments: [] } })).status, 403);

check('a member cannot read the whole roster grid',
  (await call('GET', '/roster/view?year=2026&month=9&page=1&page_size=5', asMember)).status, 403);

// And an ADMIN still can, so the checks refuse the right people.
check('an admin still lists staff', (await call('GET', '/admins', { token: wTok })).status, 200);
check('  and reads the roster grid',
  (await call('GET', '/roster/view?year=2026&month=9&page=1&page_size=5', { token: wTok })).status, 200);
check('a superadmin still creates an institution',
  (await call('POST', '/institutions', { token: suToken, body: { name: 'Second Inst', code: 2 } })).status, 201);

process.exit(report() ? 0 : 1);
