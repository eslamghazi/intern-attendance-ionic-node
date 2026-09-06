// Concurrency on the one path where it matters.
//
// decideCheckIn refuses a second check-in for a slot — but it decides that from
// a READ, and two requests arriving together both pass it. writeCheckIn then
// upserted with a plain `do update`, so the second silently overwrote the
// first, `status` included: a `late` could become a `present` depending on
// which finished last.
//
// The write is first-wins now (`where check_in_at is null`), and the loser gets
// the 409 the domain already had a name for. This is the check that says so.
//
// The window is milliseconds and the unique constraint always prevented a
// duplicate ROW, so this was never corruption — but on an attendance record for
// a medical faculty, "which of the two wrote last" is not an acceptable answer
// to "were they late".
import { call, check, login, psql, report } from './harness.mjs';

console.log('\n--- two check-ins at the same instant ---');

// --- fixtures: a member rostered today, with the gates opened -------------
psql(`delete from public.profiles where full_name = 'Race Member'`);
psql(`update public.app_settings
         set bypass_face = true, bypass_location = true,
             enforce_shift_window = false, liveness_required = false,
             require_play_integrity = false, checkin_method = 'location'
       where id = 1`);

const inst = psql(`select id from public.institutions limit 1`);
const branch = psql(`select id from public.branches limit 1`);
const group = psql(`select id from public.groups limit 1`);
psql(`insert into public.shifts (name, start_time, end_time)
      select 'Race Shift', '00:00', '23:59'
       where not exists (select 1 from public.shifts where name = 'Race Shift')`);
const shift = psql(`select id from public.shifts where name = 'Race Shift'`);

psql(`insert into public.profiles (role, full_name, national_id)
      values ('member', 'Race Member', '30707071234567')`);
const profile = psql(`select id from public.profiles where national_id = '30707071234567'`);
psql(`insert into public.members (profile_id, group_id, branch_id)
      values ('${profile}', '${group}', '${branch}')`);
const member = psql(`select id from public.members where profile_id = '${profile}'`);
const today = psql(`select (now() at time zone 'Africa/Cairo')::date`);
psql(`insert into public.roster_days (member_id, date, shift_id)
      values ('${member}', '${today}', '${shift}') on conflict do nothing`);
psql(`delete from public.attendance where member_id = '${member}'`);

const signIn = await login('30707071234567', '30707071234567');
check('the rostered member signs in', signIn.status, 200);
const me = signIn.body;

const body = {
  type: 'check_in', lat: 31.0, lng: 30.0, accuracy: 5,
  is_mock: false, liveness_passed: true, face_score: 0.99,
};

const fire = () => call('POST', '/attendance/record', { token: me.access_token, body });

// Both in flight before either can finish.
const [a, b] = await Promise.all([fire(), fire()]);

console.log(`       A -> ${a.status}   B -> ${b.status}`);

const rows = psql(`select count(*) from public.attendance
                    where member_id = '${member}' and date = '${today}'`);
const statuses = psql(`select coalesce(string_agg(status::text, ','), '(none)')
                         from public.attendance
                        where member_id = '${member}' and date = '${today}'`);

const accepted = [a.status, b.status].filter((s) => s === 200).length;
const refused = [a.status, b.status].filter((s) => s === 409).length;

// Which of the two wins is genuinely undetermined — that is what a race is.
// What must be determined is that only one does.
check('exactly one check-in is accepted', accepted, 1);
check('  the other is refused, not silently applied', refused, 1);
check('  one attendance row, not one written over twice', rows, '1');
check('  and it kept a status', statuses !== '(none)', true);

// Restore what the fixtures opened. Leaving the gates down would make every
// later run of the OTHER suites pass for the wrong reason.
psql(`delete from public.profiles where full_name = 'Race Member'`);
psql(`delete from public.shifts where name = 'Race Shift'`);
psql(`update public.app_settings
         set bypass_face = false, bypass_location = false,
             enforce_shift_window = true, liveness_required = true,
             checkin_method = 'both'
       where id = 1`);

process.exit(report() ? 0 : 1);
