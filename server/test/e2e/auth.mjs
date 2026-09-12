// Everything that moved out of SQL into services/authService.ts:
// sign-in precedence, the master password, the
// admin-side resets, and staff creation and deletion.

import {
  SUPERADMIN,
  call,
  check,
  grantAll,
  login,
  psql,
  report,
} from './harness.mjs';

console.log('\n--- sign-in ---');
const su = await login(SUPERADMIN.nationalId, SUPERADMIN.password);
check('superadmin with own password', su.status, 200);
const suToken = su.body?.access_token;
check('  returns a role', su.body?.role, 'superadmin');
// The two refusals say different things, and the codes are what the login
// screen switches on — an unknown national id is told it is not registered, a
// known one is told nothing about which half was wrong.
const wrongPw = await login(SUPERADMIN.nationalId, 'nope');
check('wrong password', wrongPw.status, 401);
check('  says national id or password', wrongPw.body?.error?.code, 'invalid_credentials');
check('  and not in code-speak', wrongPw.body?.error?.message, 'الرقم القومي أو كلمة المرور غير صحيحة');
const unknownNid = await login('29001010000000', 'x');
check('unknown national id', unknownNid.status, 404);
check('  says not registered', unknownNid.body?.error?.code, 'not_registered');
check('  in Arabic', unknownNid.body?.error?.message, 'هذا الرقم القومي غير مسجل');
check('empty password', (await login(SUPERADMIN.nationalId, '')).status, 401);

console.log('\n--- a deactivated account is not told it exists ---');
psql(`update public.profiles set is_active = false where national_id = '${SUPERADMIN.nationalId}'`);
const frozen = await login(SUPERADMIN.nationalId, SUPERADMIN.password);
check('refused with the credentials message', frozen.status, 401);
check('  not "not registered"', frozen.body?.error?.code, 'invalid_credentials');
psql(`update public.profiles set is_active = true where national_id = '${SUPERADMIN.nationalId}'`);
check('restored', (await login(SUPERADMIN.nationalId, SUPERADMIN.password)).status, 200);

console.log('\n--- staff lifecycle ---');
const ADMIN_NID = '29505151234561';
const made = await call('POST', '/auth/staff', {
  token: suToken,
  body: { national_id: ADMIN_NID, full_name: 'Test Admin', role: 'admin' },
});
check('create admin', made.status, 201);
const adminId = made.body?.id;
const adminPw = made.body?.password;
// Resetting a member's password needs the members page; grant it all.
check('  granted every page', (await grantAll(suToken, adminId, 'Test Admin', ADMIN_NID)).status, 200);
console.log(`       default password derived from the national id: ${adminPw}`);

const a1 = await login(ADMIN_NID, adminPw);
check('new admin signs in', a1.status, 200);
let adminToken = a1.body?.access_token;

// THE FORCED FIRST CHANGE IS GONE, and so is the route it gated.
// POST /auth/password/initial set a password without proving the current
// one, and must_change_password was the only thing in front of it — a flag
// removed on its own would have left a password reset any signed-in session
// could call. A new admin uses the password they were handed, through the
// ordinary route, like everybody else.
console.log('\n--- the first change is an ordinary one ---');
check('the retired route is gone', (await call('POST', '/auth/password/initial', {
  token: adminToken, body: { new: 'Sneaky!123' },
})).status, 404);
check('the password they were given still opens the account',
  (await login(ADMIN_NID, adminPw)).status, 200);
check('changing it needs that password', (await call('POST', '/auth/password', {
  token: adminToken, body: { current: adminPw, new: 'FirstPass!1' },
})).status, 200);
check('old password stops working', (await login(ADMIN_NID, adminPw)).status, 401);
const a2 = await login(ADMIN_NID, 'FirstPass!1');
check('new password works', a2.status, 200);
adminToken = a2.body?.access_token;

console.log('\n--- change with current ---');
check('wrong current refused', (await call('POST', '/auth/password', {
  token: adminToken, body: { current: 'wrong', new: 'SecondPass!2' },
})).status, 401);
check('correct current accepted', (await call('POST', '/auth/password', {
  token: adminToken, body: { current: 'FirstPass!1', new: 'SecondPass!2' },
})).status, 200);
check('signs in with the new one', (await login(ADMIN_NID, 'SecondPass!2')).status, 200);

console.log('\n--- what /auth/me hands the browser ---');
// NOBODY CHECKED THE CONTENTS. Every suite asserted /auth/me answered 200 and
// went on, so it returned the caller's own bcrypt hash on every sign-in — and
// spelled every field the way the database does, while the client reads
// snake_case, so the branch rules were all undefined.
const meSu = await call('GET', '/auth/me', { token: suToken });
check('/auth/me answers', meSu.status, 200);
check('  in the API\'s own snake_case', typeof meSu.body?.profile?.full_name, 'string');
check('  carrying no password hash',
  Object.keys(meSu.body?.profile ?? {}).some((k) => /hash|password_hash/.test(k)), false);
check('  nor any other credential material',
  JSON.stringify(meSu.body ?? {}).includes('$2a$'), false);
check('  and staff belong to no branch', meSu.body?.member, null);

console.log('\n--- master password ---');
check('not configured yet', (await call('GET', '/settings/master-password', { token: suToken })).body?.configured, false);
// One string that opens every admin account, so it has a floor of its own —
// MASTER_PASSWORD_MIN, not the 6 an ordinary account gets. There was none at
// all: a single character was accepted.
check('a short one is refused', (await call('PUT', '/settings/master-password', {
  token: suToken, body: { password: 'short1!' },
})).status, 400);
check('  and nothing was stored', (await call('GET', '/settings/master-password', { token: suToken })).body?.configured, false);
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

console.log('\n--- superadmin backup and restore ---');
// The accounts that can do everything, and the one page that can copy them.
const accounts = await call('GET', '/superadmin/accounts', { token: suToken });
check('the superadmin lists the accounts', accounts.status, 200);
check('  and there is at least one', (accounts.body ?? []).length >= 1, true);
check('  with no password hash in sight',
  JSON.stringify(accounts.body ?? []).includes('$2a$'), false);

const backup = await call('GET', '/superadmin/backup', { token: suToken, raw: true });
check('the backup downloads', backup.status, 200);
check('  as an attachment',
  (backup.headers.get('content-disposition') ?? '').includes('superadmin-backup'), true);
const file = JSON.parse(backup.bytes.toString('utf8'));
check('  stamped so a restore can recognise it', file.kind, 'intern-attendance/superadmin-backup');
// The hash IS in the file — that is the point of it, and why it is a secret.
check('  carrying the hashes that make a restore faithful',
  typeof file.accounts?.[0]?.password_hash, 'string');

// Restoring the file we just took changes nothing: every account still exists.
const noop = await call('POST', '/superadmin/restore', {
  token: suToken, body: { file, overwrite: false },
});
check('restoring over live accounts adds nothing', noop.body?.added, 0);
check('  and skips them instead', noop.body?.skipped >= 1, true);

// YOUR OWN ACCOUNT IS NEVER OVERWRITTEN, even when asked. Restoring an old
// backup over yourself swaps your password for one you have forgotten.
const overSelf = await call('POST', '/superadmin/restore', {
  token: suToken, body: { file, overwrite: true },
});
check('overwrite: true still refuses your own account', overSelf.body?.overwritten, 0);
check('  and says why',
  (overSelf.body?.accounts ?? []).some((a) => /your own account/.test(a.reason ?? '')), true);

// A file that is not one of ours is refused with the reason.
const junk = await call('POST', '/superadmin/restore', {
  token: suToken, body: { file: { kind: 'nope' }, overwrite: false },
});
check('a foreign file is refused', junk.status, 400);
check('  naming what was wrong', /not a superadmin backup/.test(junk.body?.error?.message ?? ''), true);

// This admin holds the backup page (grantAll), so listing and downloading
// open. Restoring NEVER does, whatever they hold: it creates superadmins, and
// a superadmin is only ever created by a superadmin.
check('an admin granted the backup page lists the accounts',
  (await call('GET', '/superadmin/accounts', { token: adminToken })).status, 200);
check('  and downloads the backup',
  (await call('GET', '/superadmin/backup', { token: adminToken, raw: true })).status, 200);
check('  but can never restore',
  (await call('POST', '/superadmin/restore', { token: adminToken, body: { file } })).status, 403);

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
// This admin holds the admins page, so deleting is theirs — but never themselves.
check('an admin may not delete themselves', (await call('DELETE', `/auth/staff/${adminId}`, { token: adminToken })).status, 400);
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
