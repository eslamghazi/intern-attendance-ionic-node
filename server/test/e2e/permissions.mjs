// Page grants, applied end to end — common/guards/permissions.guard.ts.
//
// The grant editor stores which pages an admin may open and what they may do
// there; for a long time only the client read that. This suite is the proof
// that the SERVER reads it too: a route refused here is refused to curl, not
// merely hidden from a menu.

import {
  ALL_GRANTABLE_PAGES,
  SUPERADMIN,
  call,
  check,
  grantAll,
  login,
  psql,
  report,
} from './harness.mjs';

psql(`delete from public.profiles where role <> 'superadmin'`);

const su = await login(SUPERADMIN.nationalId, SUPERADMIN.password);
const suToken = su.body?.access_token;
const suId = su.body?.profile?.id;

/* ------------------------------------------------------ a brand-new admin */
console.log('\n--- an admin nobody has configured holds nothing ---');
const NID = '29707171234563';
const made = await call('POST', '/auth/staff', {
  token: suToken,
  body: { national_id: NID, full_name: 'Fresh Admin', role: 'admin' },
});
check('created', made.status, 201);
const adminId = made.body?.id;
let tok = (await login(NID, made.body?.password)).body?.access_token;
check('signs in', typeof tok, 'string');

check('is refused the members page', (await call('GET', '/members', { token: tok })).status, 403);
check('is refused the dashboard', (await call('GET', `/attendance/stats?year=2026&month=9`, { token: tok })).status, 403);
check('is refused the roster', (await call('GET', '/roster/view?year=2026&month=9', { token: tok })).status, 403);
check('is refused the audit trail', (await call('GET', '/audit', { token: tok })).status, 403);
check('is refused the location-bypass QR', (await call('POST', '/qr', { token: tok, body: {} })).status, 403);
check('is refused the shifts catalogue', (await call('POST', '/shifts', { token: tok, body: {} })).status, 403);

console.log('\n--- but the routes every admin screen needs still answer ---');
check('their own account', (await call('GET', '/auth/me', { token: tok })).status, 200);
check('the branch options behind every filter', (await call('GET', '/branches/options', { token: tok })).status, 200);
check('the group options', (await call('GET', '/groups/options', { token: tok })).status, 200);
check('the shifts, read-only', (await call('GET', '/shifts', { token: tok })).status, 200);
check('the department options', (await call('GET', '/departments/options', { token: tok })).status, 200);

/* ------------------------------------------------------------ one page */
console.log('\n--- granting one page opens it, and only it ---');
const patch = (permissions) =>
  call('PATCH', `/admins/${adminId}`, {
    token: suToken,
    body: { full_name: 'Fresh Admin', national_id: NID, permissions },
  });

check('granted members, read only', (await patch({ pages: ['members'] })).status, 200);
check('the members list opens', (await call('GET', '/members', { token: tok })).status, 200);
check('  on the SAME token — no sign-in needed', (await call('GET', '/members/national-ids', { token: tok })).status, 200);
check('the dashboard is still refused', (await call('GET', `/attendance/stats?year=2026&month=9`, { token: tok })).status, 403);
// A refused operation is refused BEFORE the handler runs: 403, never 404.
const noEdit = await call('PATCH', '/members/00000000-0000-4000-8000-000000000000', { token: tok, body: { full_name: 'x' } });
check('editing is refused without the operation', noEdit.status, 403);
check('  by the guard, not the handler', noEdit.body?.error?.code, 'forbidden');
check('deleting too', (await call('POST', '/members/bulk/delete', { token: tok, body: { member_ids: [] } })).status, 403);
check('exporting too', (await call('GET', '/members/export', { token: tok })).status, 403);

console.log('\n--- granting the operation opens it ---');
check('granted edit on members', (await patch({ pages: ['members'], pageOps: { members: ['edit'] } })).status, 200);
const pastGuard = await call('PATCH', '/members/00000000-0000-4000-8000-000000000000', { token: tok, body: { full_name: 'x' } });
// Anything but 403 is the handler answering — here its validation (400).
check('the edit reaches the handler now', pastGuard.status !== 403, true);
check('  which answers for itself', pastGuard.status, 400);
check('delete is still refused — a different operation', (await call('POST', '/members/bulk/delete', { token: tok, body: { member_ids: [] } })).status, 403);

console.log('\n--- an operation the page does not have cannot be granted ---');
check('stored "delete" on the dashboard is noise', (await patch({ pages: ['dashboard'], pageOps: { dashboard: ['delete', 'export'] } })).status, 200);
check('  the dashboard opens', (await call('GET', `/attendance/stats?year=2026&month=9`, { token: tok })).status, 200);
check('  its export is allowed', (await call('GET', `/attendance/dashboard/export?year=2026&month=9`, { token: tok })).status, 200);
check('  members is gone again', (await call('GET', '/members', { token: tok })).status, 403);

console.log('\n--- a shared lookup is satisfied by either page ---');
check('granted groups only', (await patch({ pages: ['groups'] })).status, 200);
check('institutions open (groups OR branches)', (await call('GET', '/institutions', { token: tok })).status, 200);
check('granted branches only', (await patch({ pages: ['branches'] })).status, 200);
check('institutions still open', (await call('GET', '/institutions', { token: tok })).status, 200);
check('granted neither', (await patch({ pages: ['audit'] })).status, 200);
check('institutions closed', (await call('GET', '/institutions', { token: tok })).status, 403);

console.log('\n--- the pages that used to be the superadmin\'s can be handed out ---');
check('granted shifts with create', (await patch({ pages: ['shifts', 'departments', 'settings'], pageOps: { shifts: ['create'], departments: [], settings: ['edit'] } })).status, 200);
check('the admin may create a shift (400: empty body, past the guard)', (await call('POST', '/shifts', { token: tok, body: {} })).status, 400);
check('but not delete one', (await call('DELETE', '/shifts/00000000-0000-4000-8000-000000000000', { token: tok })).status, 403);
check('may read departments', (await call('GET', '/departments', { token: tok })).status, 200);
check('but not save one', (await call('PUT', '/departments', { token: tok, body: {} })).status, 403);
check('may edit settings (400: empty body, past the guard)', (await call('PATCH', '/settings', { token: tok, body: {} })).status, 400);
check('but NEVER the master password — no grant covers it', (await call('PUT', '/settings/master-password', { token: tok, body: { password: 'MasterKey!2026' } })).status, 403);

console.log('\n--- nothing is reserved: the admins page and the backup page can be granted ---');
check('granted everything, those two included', (await grantAll(suToken, adminId, 'Fresh Admin', NID)).status, 200);
check('the admins page opens', (await call('GET', '/admins', { token: tok })).status, 200);
check('  and leaves the caller\'s own account out', (await call('GET', '/admins', { token: tok })).body?.some((a) => a.id === adminId), false);
check('the backup downloads', (await call('GET', '/superadmin/backup', { token: tok, raw: true })).status, 200);
check('  and the account list', (await call('GET', '/superadmin/accounts', { token: tok })).status, 200);

console.log('\n--- but what an admin may touch there is bounded per target ---');
// A second admin, for the granted one to manage.
const peer = await call('POST', '/auth/staff', {
  token: tok, body: { national_id: '29606161234566', full_name: 'Peer Admin', role: 'admin' },
});
check('an admin granted create creates an admin', peer.status, 201);
check('  and may edit that admin', (await call('PATCH', `/admins/${peer.body?.id}`, {
  token: tok, body: { full_name: 'Peer Admin', national_id: '29606161234566', permissions: { pages: ['dashboard'] } },
})).status, 200);
check('  but NOT themselves - a grant one can edit is a grant one can widen', (await call('PATCH', `/admins/${adminId}`, {
  token: tok, body: { full_name: 'Fresh Admin', national_id: NID, permissions: { pages: ALL_GRANTABLE_PAGES } },
})).status, 403);
check('  and NOT a superadmin', (await call('PATCH', `/admins/${suId}`, {
  token: tok, body: { full_name: 'x', national_id: SUPERADMIN.nationalId },
})).status, 403);
check('  nor assign one', (await call('POST', '/admins/assignments', {
  token: tok, body: { admin_id: suId },
})).status, 403);
check('an admin NEVER creates a superadmin, whatever they hold', (await call('POST', '/auth/staff', {
  token: tok, body: { national_id: '29606161234567', full_name: 'x', role: 'superadmin' },
})).status, 403);
check('and never restores one', (await call('POST', '/superadmin/restore', {
  token: tok, body: { file: { kind: 'intern-attendance/superadmin-backup', accounts: [] }, overwrite: false },
})).status, 403);
check('and never sets the master password', (await call('PUT', '/settings/master-password', {
  token: tok, body: { password: 'MasterKey!2026' },
})).status, 403);
check('an admin granted delete deletes an admin', (await call('DELETE', `/auth/staff/${peer.body?.id}`, { token: tok })).status, 200);
check('  but never a superadmin', (await call('DELETE', `/auth/staff/${suId}`, { token: tok })).status, 403);

/* ------------------------------------------- a type, in one request */
console.log('\n--- an account and its starting grant are one request ---');
// What the Admins page sends when a "supervisor" is picked: role + grant
// together, so there is never an account that exists for a moment with nothing.
const typed = await call('POST', '/auth/staff', {
  token: suToken,
  body: {
    national_id: '29808181234564', full_name: 'Typed Admin', role: 'admin',
    permissions: { pages: ['dashboard', 'review'], pageOps: { dashboard: ['export'], review: ['edit', 'export'] } },
  },
});
check('created with a grant', typed.status, 201);
const typedTok = (await login('29808181234564', typed.body?.password)).body?.access_token;
check('  the dashboard opens at once — no PATCH in between', (await call('GET', `/attendance/stats?year=2026&month=9`, { token: typedTok })).status, 200);
check('  and nothing that was not granted', (await call('GET', '/members', { token: typedTok })).status, 403);
check('  the grant is what the list reports', (await call('GET', '/admins', { token: suToken })).body?.find((a) => a.id === typed.body?.id)?.permissions?.pages?.sort().join(','), 'dashboard,review');
const typedSuper = await call('POST', '/auth/staff', {
  token: suToken,
  body: { national_id: '29808181234565', full_name: 'Typed Super', role: 'superadmin', permissions: { pages: ['audit'] } },
});
check('a superadmin created with a grant stores none — the role holds everything', typedSuper.status, 201);
check('  column is null', (await call('GET', '/admins', { token: suToken })).body?.find((a) => a.id === typedSuper.body?.id)?.permissions, null);
psql(`delete from public.profiles where national_id in ('29808181234564', '29808181234565')`);

/* ------------------------------------------------------- superadmins */
console.log('\n--- who the admins page shows, and who may make a superadmin ---');
const list = await call('GET', '/admins', { token: suToken });
check('the superadmin lists staff', list.status, 200);
check('  without their own account', (list.body ?? []).some((a) => a.id === suId), false);
check('  but with the admin', (list.body ?? []).some((a) => a.id === adminId), true);

const second = await call('POST', '/auth/staff', {
  token: suToken,
  body: { national_id: '29909191234565', full_name: 'Second Superadmin', role: 'superadmin' },
});
check('a superadmin creates another superadmin', second.status, 201);
const s2 = await login('29909191234565', second.body?.password);
check('  who signs in', s2.status, 200);
check('  as a superadmin', s2.body?.role, 'superadmin');
check('  and holds every page with no grant at all', (await call('GET', '/admins', { token: s2.body?.access_token })).status, 200);
check('  and is listed to the first', (await call('GET', '/admins', { token: suToken })).body?.some((a) => a.id === second.body?.id), true);
check('  but not to themselves', (await call('GET', '/admins', { token: s2.body?.access_token })).body?.some((a) => a.id === second.body?.id), false);

// Leave the database as found: one superadmin. The next suite's reset keeps
// every superadmin, and the runner sets the seeded one's password by name.
psql(`delete from public.profiles where national_id = '29909191234565'`);

process.exit(report() ? 0 : 1);
