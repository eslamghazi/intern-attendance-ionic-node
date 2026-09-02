// Everything that moved out of SQL into services/authService.ts:
// sign-in precedence, the master password, the forced first change, the
// admin-side resets, and staff creation and deletion.

import {
  SUPERADMIN,
  call,
  check,
  login,
  psql,
  report,
} from './harness.mjs';

console.log('\n--- sign-in ---');
const su = await login(SUPERADMIN.nationalId, SUPERADMIN.password);
check('superadmin with own password', su.status, 200);
const suToken = su.body?.access_token;
check('  returns a role', su.body?.role, 'superadmin');
check('wrong password', (await login(SUPERADMIN.nationalId, 'nope')).status, 401);
check('unknown national id', (await login('29001010000000', 'x')).status, 404);
check('empty password', (await login(SUPERADMIN.nationalId, '')).status, 401);

console.log('\n--- staff lifecycle ---');
const ADMIN_NID = '29505151234561';
const made = await call('POST', '/auth/staff', {
  token: suToken,
  body: { national_id: ADMIN_NID, full_name: 'Test Admin', role: 'admin' },
});
check('create admin', made.status, 201);
const adminId = made.body?.id;
const adminPw = made.body?.password;
console.log(`       default password derived from the national id: ${adminPw}`);

const a1 = await login(ADMIN_NID, adminPw);
check('new admin signs in', a1.status, 200);
check('  must_change_password', a1.body?.must_change_password, true);
let adminToken = a1.body?.access_token;

console.log('\n--- forced first change ---');
check('initial change', (await call('POST', '/auth/password/initial', {
  token: adminToken, body: { new: 'FirstPass!1' },
})).status, 200);
check('old password stops working', (await login(ADMIN_NID, adminPw)).status, 401);
const a2 = await login(ADMIN_NID, 'FirstPass!1');
check('new password works', a2.status, 200);
check('  must_change_password cleared', a2.body?.must_change_password, false);
adminToken = a2.body?.access_token;
check('initial change refused once set', (await call('POST', '/auth/password/initial', {
  token: adminToken, body: { new: 'Sneaky!123' },
})).status, 403);

console.log('\n--- change with current ---');
check('wrong current refused', (await call('POST', '/auth/password', {
  token: adminToken, body: { current: 'wrong', new: 'SecondPass!2' },
})).status, 401);
check('correct current accepted', (await call('POST', '/auth/password', {
  token: adminToken, body: { current: 'FirstPass!1', new: 'SecondPass!2' },
})).status, 200);
check('signs in with the new one', (await login(ADMIN_NID, 'SecondPass!2')).status, 200);

console.log('\n--- master password ---');
check('not configured yet', (await call('GET', '/settings/master-password', { token: suToken })).body?.configured, false);
check('superadmin sets it', (await call('PUT', '/settings/master-password', {
  token: suToken, body: { password: 'MasterKey!2026' },
})).status, 200);
check('now configured', (await call('GET', '/settings/master-password', { token: suToken })).body?.configured, true);
check('admin may not set it', (await call('PUT', '/settings/master-password', {
  token: adminToken, body: { password: 'x' },
})).status, 403);
check('opens an admin', (await login(ADMIN_NID, 'MasterKey!2026')).status, 200);
check('NEVER opens a superadmin', (await login(SUPERADMIN.nationalId, 'MasterKey!2026')).status, 403);
check('own password still wins for the superadmin', (await login(SUPERADMIN.nationalId, SUPERADMIN.password)).status, 200);

console.log('\n--- member: national id as the initial password ---');
// A member as a roster upload creates one: a profile with NO password hash.
const MEMBER_NID = '30101011234563';
psql(
  `insert into public.profiles (role, full_name, national_id, created_by)
   values ('member', 'Test Member', '${MEMBER_NID}',
           (select id from public.profiles where national_id = '${ADMIN_NID}'))`,
);
const m1 = await login(MEMBER_NID, MEMBER_NID);
check('signs in with their national id', m1.status, 200);
check('wrong password still refused', (await login(MEMBER_NID, '00000000000000')).status, 401);

console.log('\n--- admin-side resets ---');
const mReset = await call('POST', '/auth/members/reset-password', {
  token: adminToken, body: { national_id: MEMBER_NID },
});
check('reset a member', mReset.status, 200);
console.log(`       reset to the date of birth: ${mReset.body?.password}`);
check('  the national id no longer works', (await login(MEMBER_NID, MEMBER_NID)).status, 401);
const m2 = await login(MEMBER_NID, mReset.body?.password);
check('  the new password does', m2.status, 200);
check('  and forces a change', m2.body?.must_change_password, true);

check('member reset refuses a staff id', (await call('POST', '/auth/members/reset-password', {
  token: adminToken, body: { profile_id: adminId },
})).status, 400);
check('admin may not reset a superadmin', (await call('POST', '/auth/staff/reset-password', {
  token: adminToken, body: { profile_id: su.body?.profile?.id },
})).status, 403);
const sReset = await call('POST', '/auth/staff/reset-password', {
  token: suToken, body: { profile_id: adminId },
});
check('superadmin resets the admin', sReset.status, 200);
check('  admin signs in with it', (await login(ADMIN_NID, sReset.body?.password)).status, 200);

console.log('\n--- delete (the created_by foreign key) ---');
// This admin created the member above. While created_by pointed at auth.users
// with no delete rule, deleting them raised a foreign key violation.
check('admin may not delete', (await call('DELETE', `/auth/staff/${adminId}`, { token: adminToken })).status, 403);
check('superadmin deletes an admin who created an account', (await call('DELETE', `/auth/staff/${adminId}`, { token: suToken })).status, 200);
check('  the account they created survives', (await login(MEMBER_NID, mReset.body?.password)).status, 200);
check('  the deleted admin cannot sign in', (await login(ADMIN_NID, sReset.body?.password)).status, 404);

console.log('\n--- clearing the master password ---');
check('cleared', (await call('PUT', '/settings/master-password', {
  token: suToken, body: { password: '' },
})).status, 200);
check('  reports unconfigured', (await call('GET', '/settings/master-password', { token: suToken })).body?.configured, false);
check('  no longer opens anything', (await login(MEMBER_NID, 'MasterKey!2026')).status, 401);

process.exit(report() ? 0 : 1);
