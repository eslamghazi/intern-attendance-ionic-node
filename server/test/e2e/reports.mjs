// Do the reports produce the right NUMBERS?
//
// The other suites check shape and permission. The report endpoints were only
// ever verified that far — "200 with a plausible body" — and that is a weak
// claim for the screen a faculty uses to decide whether a student passed a
// placement.
//
// The arithmetic is pure and unit-tested (domain/report/rate.ts). What was
// never tested is the SQL that feeds it: whether `attended`, `late`, `absent`
// and `pending` count the rows a human would count.
//
// So this builds two months whose answers are known by hand.
//
// A month in the PAST — every slot concluded, so every one is decided:
//
//     member A   present, late, present, present
//     member B   present, (nothing), present, late
//     member C   nothing at all
//
//   12 rostered slots = 3 members x 4 days
//     attended 7, of which late 2   ->  present 5
//     absent   5   (the slots nobody came to)
//     pending  0   (nothing is undecided in a month that is over)
//     rate     7/12
//
// A month in the FUTURE — nothing concluded, so nothing is absent:
//
//     pending  2,  absent 0
//
// That second month is the one that matters. A slot a member cannot have
// attended yet must not count against them; scoring it as absent is how a
// system marks a whole term failed in advance.
//
// Both months are computed from the database's today, not hardcoded, so this
// keeps meaning the same thing next year.
import { SUPERADMIN, call, check, login, psql, report } from './harness.mjs';

console.log('\n--- months whose answers are known by hand ---');

/* ------------------------------------------------------------------ fixtures */

const wipe = () => {
  psql(`delete from public.profiles where full_name like 'Report %'`);
  psql(`delete from public.shifts where name = 'Report Shift'`);
};
wipe();

const branch = psql(`select id from public.branches limit 1`);
const group = psql(`select id from public.groups limit 1`);

psql(`insert into public.shifts (name, start_time, end_time)
      values ('Report Shift', '08:00', '14:00')`);
const shift = psql(`select id from public.shifts where name = 'Report Shift'`);

// Far enough either side of today that no run of this suite lands on a
// boundary, and read from the database so "today" means what the app means.
const cairo = `(now() at time zone 'Africa/Cairo')::date`;
const monthOf = (offset) =>
  psql(`select to_char(${cairo} + interval '${offset} months', 'YYYY-MM')`);

const PAST = monthOf(-3);
const FUTURE = monthOf(3);
const [pastYear, pastMonth] = PAST.split('-').map(Number);
const [futureYear, futureMonth] = FUTURE.split('-').map(Number);

const days = ['03', '04', '05', '06'].map((d) => `${PAST}-${d}`);
const futureDay = `${FUTURE}-15`;

console.log(`       settled month ${PAST}   open month ${FUTURE}`);

const members = {};
for (const [i, name] of ['A', 'B', 'C'].entries()) {
  const nid = `3010101123456${i + 1}`;
  psql(`insert into public.profiles (role, full_name, national_id)
        values ('member', 'Report ${name}', '${nid}')`);
  const profile = psql(`select id from public.profiles where national_id = '${nid}'`);
  psql(`insert into public.members (profile_id, group_id, branch_id)
        values ('${profile}', '${group}', '${branch}')`);
  members[name] = psql(`select id from public.members where profile_id = '${profile}'`);
}

const roster = (member, date) =>
  psql(`insert into public.roster_days (member_id, date, shift_id)
        values ('${member}', '${date}', '${shift}') on conflict do nothing`);

for (const m of Object.values(members)) for (const d of days) roster(m, d);
// Only A and C are rostered in the open month.
roster(members.A, futureDay);
roster(members.C, futureDay);

const attend = (member, date, status) =>
  psql(`insert into public.attendance
          (member_id, branch_id, date, shift_id, status, check_in_at)
        values ('${member}', '${branch}', '${date}', '${shift}', '${status}',
                '${date}T08:00:00Z')
        on conflict (member_id, date, shift_id) do nothing`);

attend(members.A, days[0], 'present');
attend(members.A, days[1], 'late');
attend(members.A, days[2], 'present');
attend(members.A, days[3], 'present');

attend(members.B, days[0], 'present');
// days[1] deliberately missing — this is the absence
attend(members.B, days[2], 'present');
attend(members.B, days[3], 'late');

// C checks in on nothing at all.

/* -------------------------------------------------------------------- assert */

const su = await login(SUPERADMIN.nationalId, SUPERADMIN.password);
check('signed in to read the report', su.status, 200);
const token = su.body.access_token;

const stats = (year, month, extra = '') =>
  call(
    'GET',
    `/attendance/stats?year=${year}&month=${month}` +
      `&branchId=${branch}&shiftId=${shift}${extra}`,
    { token },
  );

// --- the settled month ----------------------------------------------------

const past = await stats(pastYear, pastMonth);
check('the stats endpoint answers', past.status, 200);

const p = past.body ?? {};
console.log(
  `       attended=${p.attended} late=${p.late} present=${p.present} ` +
    `absent=${p.absent} pending=${p.pending} rate=${p.rate} (${p.rateBasis})`,
);

check('attended is 7', p.attended, 7);
check('  of which 2 were late', p.late, 2);
check('  leaving 5 present', p.present, 5);
check('absent is 5 — rostered, concluded, nobody came', p.absent, 5);
check('nothing is pending in a month that is over', p.pending, 0);
check('all 12 slots are settled', p.settled, 12);
check('the rate is 7 of 12', p.rate, Math.round((7 / 12) * 100));
check('  and says so', p.rateBasis, 'settled');

// --- the open month -------------------------------------------------------

const future = await stats(futureYear, futureMonth);
check('the open month answers', future.status, 200);

const f = future.body ?? {};
console.log(
  `       attended=${f.attended} absent=${f.absent} pending=${f.pending} ` +
    `rate=${f.rate} (${f.rateBasis})`,
);

check('a slot that has not happened is PENDING', f.pending, 2);
check('  and is NOT counted as an absence', f.absent, 0);
check('  nothing is settled yet', f.settled, 0);
check('  so the rate is not on a settled basis', f.rateBasis, 'open');

// --- one day of the settled month ----------------------------------------

const day = await stats(pastYear, pastMonth, '&day=4');
check('a single day narrows', day.status, 200);
check('  A and B were rostered and A came late', day.body?.late, 1);
check('  one of the three came', day.body?.attended, 1);
check('  and two did not', day.body?.absent, 2);

/* ------------------------------------------------------------------- clean up */

wipe();

process.exit(report() ? 0 : 1);
