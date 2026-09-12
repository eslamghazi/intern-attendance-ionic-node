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
import { ORIGIN, SUPERADMIN, call, check, login, psql, report } from './harness.mjs';

console.log('\n--- months whose answers are known by hand ---');

/* ------------------------------------------------------------------ fixtures */

const wipe = () => {
  psql(`delete from public.profiles where full_name like 'Report %'`);
  psql(`delete from public.shifts where name = 'Report Shift'`);
};
wipe();

const branch = psql(`select id from public.branches limit 1`);
const group = psql(`select id from public.groups limit 1`);

// With its own windows: late from 08:00, check-out from 14:00. Without them
// the installation's global shift_start/shift_end (07:00/17:00 by default)
// would decide, and "08:30 is late" below would be about the settings, not
// the shift.
psql(`insert into public.shifts (name, start_time, end_time, checkin_late, checkout_open)
      values ('Report Shift', '08:00', '14:00', '08:00', '14:00')`);
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

/* --------------------------------------------------------------- the exports */

// The export routes had no end-to-end coverage at all: every one of them was
// only ever checked by reading. They are also the only place the report
// vocabulary, the workbook writer and the print document meet a real request.
console.log('\n--- the member\'s own month, as a file ---');

const aToken = (await login('30101011234561', '30101011234561')).body?.access_token;
check('member A signed in', typeof aToken, 'string');

const xlsx = await call(
  'GET',
  `/attendance/history/export?member_id=${members.A}&year=${pastYear}&month=${pastMonth}&format=xlsx`,
  { token: aToken, raw: true },
);
check('a member exports their own history', xlsx.status, 200);
check('  as a spreadsheet',
  (xlsx.headers.get('content-type') ?? '').includes('spreadsheetml'), true);
// A zip container: every .xlsx starts 'PK'. An empty or HTML body would not.
check('  and it is a real workbook', xlsx.bytes.subarray(0, 2).toString(), 'PK');
check('  named for the month',
  (xlsx.headers.get('content-disposition') ?? '').includes(`${pastYear}`), true);

const pdf = await call(
  'GET',
  `/attendance/history/export?member_id=${members.A}&year=${pastYear}&month=${pastMonth}&format=pdf`,
  { token: aToken, raw: true },
);
check('the print document comes back as HTML', pdf.status, 200);
check('  with the right content type',
  (pdf.headers.get('content-type') ?? '').includes('text/html'), true);
const html = pdf.bytes.toString('utf8');
// The legend is generated from ATTENDANCE_OUTCOME, so its presence is what says
// the shared vocabulary reached the file rather than a hand-written copy.
check('  and carries the legend', /report|legend|دليل/i.test(html), true);

// THE SCOPE. getHistory refuses a member asking about anyone else, and the
// export inherits that check rather than restating it.
const foreign = await call(
  'GET',
  `/attendance/history/export?member_id=${members.B}&year=${pastYear}&month=${pastMonth}`,
  { token: aToken, raw: true },
);
check('a member CANNOT export another member\'s history', foreign.status >= 400, true);

console.log('\n--- the dashboard, as a file ---');

const suToken = (await login(SUPERADMIN.nationalId, SUPERADMIN.password)).body?.access_token;

const dash = await call(
  'GET',
  `/attendance/dashboard/export?year=${pastYear}&month=${pastMonth}&format=xlsx`,
  { token: suToken, raw: true },
);
check('the dashboard exports', dash.status, 200);
check('  as a real workbook', dash.bytes.subarray(0, 2).toString(), 'PK');

const dashPdf = await call(
  'GET',
  `/attendance/dashboard/export?year=${pastYear}&month=${pastMonth}&format=pdf`,
  { token: suToken, raw: true },
);
check('  and as a print document', dashPdf.status, 200);
// The settled month has 7 attended of 12, so the rate must be in the file. If
// the numbers were not reaching it, this is what says so.
check('  carrying the month\'s real numbers',
  /58|7/.test(dashPdf.bytes.toString('utf8')), true);
check('  with no charts unless the screen sent some',
  dashPdf.bytes.toString('utf8').includes('<svg '), false);
check('  and the copyright line',
  dashPdf.bytes.toString('utf8').includes('Calaix AI · Eslam Ghazi'), true);

console.log('\n--- the organisation is on every file ---');
// The name and logo from Settings. A 1×1 PNG stands in for the logo — what
// the Settings page stores after normalising whatever was picked. The name is
// ASCII on purpose: psql() hands its statement over a Windows command line,
// which delivers Arabic in the console code page and Postgres rejects it.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
psql(`update public.app_settings set org_name = 'Faculty of Nursing', org_logo_url = '${PNG}' where id = 1`);
const branded = await call(
  'GET',
  `/attendance/dashboard/export?year=${pastYear}&month=${pastMonth}&format=pdf`,
  { token: suToken, raw: true },
);
const brandedHtml = branded.bytes.toString('utf8');
check('the print document names the organisation before the title', brandedHtml.includes('<h1>Faculty of Nursing — '), true);
check('  and embeds its logo in the header', brandedHtml.includes(`<div class="head">\n    <img src="${PNG}"`), true);
check('  and the Calaix mark by the copyright', /foot--brand"><img src="data:image\/svg\+xml;base64,/.test(brandedHtml), true);
const brandedXlsx = await call(
  'GET',
  `/attendance/dashboard/export?year=${pastYear}&month=${pastMonth}&format=xlsx`,
  { token: suToken, raw: true },
);
check('the workbook embeds the logo as an image', brandedXlsx.bytes.toString('latin1').includes('xl/media/image1.png'), true);
// The other exports go through the same service, so one more is enough to
// prove it is not a dashboard-only path.
const membersXlsx = await call('GET', '/members/export?format=xlsx', { token: suToken, raw: true });
check('so does the members export', membersXlsx.status === 200 && membersXlsx.bytes.toString('latin1').includes('xl/media/image1.png'), true);

console.log('\n--- and on the link preview ---');
// A crawler fetches the page with no token and reads its <meta> tags.
const page = await fetch(`${ORIGIN}/`);
const pageHtml = await page.text();
check('the index page answers', page.status, 200);
check('  named for the organisation', pageHtml.includes('<title>Faculty of Nursing — نظام الحضور</title>'), true);
check('  with an og:title to match', pageHtml.includes('<meta property="og:title" content="Faculty of Nursing — نظام الحضور"'), true);
check('  and an ABSOLUTE og:image on this origin', pageHtml.includes(`<meta property="og:image" content="${ORIGIN}/api/v1/settings/branding/logo.png"`), true);
check('  and an absolute og:url', pageHtml.includes(`<meta property="og:url" content="${ORIGIN}/"`), true);
const deep = await fetch(`${ORIGIN}/admin/dashboard`);
check('a deep link previews the same way (SPA fallback)', (await deep.text()).includes('og:title" content="Faculty of Nursing'), true);
const logoRes = await fetch(`${ORIGIN}/api/v1/settings/branding/logo.png`);
check('the logo route serves the organisation\'s logo', logoRes.status, 200);
check('  as an image', logoRes.headers.get('content-type'), 'image/png');
check('  the bytes Settings holds', Buffer.from(await logoRes.arrayBuffer()).toString('base64'), PNG.split(',')[1]);
psql(`update public.app_settings set org_name = null, org_logo_url = null where id = 1`);

console.log('\n--- the charts travel with it ---');
// The screen names the panels it is showing; the file draws the same numbers.
const withCharts = await call(
  'GET',
  `/attendance/dashboard/export?year=${pastYear}&month=${pastMonth}&format=pdf&charts=donut,branch,trendBar,bogus`,
  { token: suToken, raw: true },
);
check('the print document draws the panels it was sent', withCharts.status, 200);
const chartsHtml = withCharts.bytes.toString('utf8');
check('  as inline SVG', (chartsHtml.match(/<svg /g) ?? []).length >= 2, true);
check('  the donut, with the rate in the middle', /<figure class="chart chart--half">/.test(chartsHtml), true);
check('  a daily trend, as columns', chartsHtml.includes('المعدل اليومي (أعمدة)') || chartsHtml.includes('Daily rate (columns)'), true);
check('  an unknown panel name is ignored, not an error', withCharts.status, 200);

const xlsxCharts = await call(
  'GET',
  `/attendance/dashboard/export?year=${pastYear}&month=${pastMonth}&format=xlsx&charts=donut,branch`,
  { token: suToken, raw: true },
);
check('the workbook gets a charts sheet', xlsxCharts.status, 200);
// A second worksheet shows up as a second sheet part in the zip's directory.
check('  as a second sheet', (xlsxCharts.bytes.toString('latin1').match(/xl\/worksheets\/sheet\d+\.xml/g) ?? []).length >= 2, true);

// A MEMBER has no business here — the dashboard is every member the caller can
// reach, not their own record.
const memberDash = await call(
  'GET',
  `/attendance/dashboard/export?year=${pastYear}&month=${pastMonth}`,
  { token: aToken, raw: true },
);
check('a member cannot export the dashboard', memberDash.status, 403);

/* ------------------------------------------------------------------- clean up */

/* ------------------------------------------------- attendance from a file */

console.log('\n--- attendance imported from a file lands only on rostered slots ---');
// The rule the whole feature exists for: no attendance except on a roster
// that exists. B has no record on days[1] (the absence above); C is rostered
// on every day but came to none. A row for a day nobody is rostered on is
// refused, and a bad time never reaches the database.
const notRostered = `${PAST}-20`;
const imported = await call('POST', '/attendance/import', {
  token: suToken,
  body: {
    rows: [
      // B on the day of the absence: came at 08:30 — late against an 08:00 shift.
      { member_id: members.B, date: days[1], shift_id: shift, check_in: '08:30', check_out: '14:05' },
      // C on days[0]: on time, left early.
      { member_id: members.C, date: days[0], shift_id: shift, check_in: '07:55', check_out: '12:00' },
      // C on days[1]: no check-in — an absence on a rostered slot, written as such.
      { member_id: members.C, date: days[1], shift_id: shift, check_in: '', check_out: '' },
      // A on a day with NO roster: refused, nothing written.
      { member_id: members.A, date: notRostered, shift_id: shift, check_in: '08:00', check_out: '14:00' },
      // A bad time never reaches the database.
      { member_id: members.A, date: days[2], shift_id: shift, check_in: '8h', check_out: '' },
    ],
  },
});
check('the import answers', imported.status, 200);
check('  three rows written', imported.body?.written, 3);
check('  one refused for having no roster', imported.body?.no_roster, 1);
check('  one refused as invalid', imported.body?.invalid, 1);
check('  each row is answered by its index',
  (imported.body?.rows ?? []).map((r) => r.outcome).join(','), 'written,written,written,no_roster,invalid');
check('  nothing was written on the unrostered day',
  psql(`select count(*) from public.attendance where member_id='${members.A}' and date='${notRostered}'`), '0');
check('  and nothing for the invalid row',
  psql(`select count(*) from public.attendance where member_id='${members.A}' and date='${days[2]}' and check_in_at is null`), '0');

const bRow = psql(`select status || '|' || coalesce(checkout_status,'') from public.attendance where member_id='${members.B}' and date='${days[1]}'`);
check('B at 08:30 on an 08:00 shift is LATE, checked out', bRow, 'late|checked_out');
const cRow = psql(`select status || '|' || coalesce(checkout_status,'') from public.attendance where member_id='${members.C}' and date='${days[0]}'`);
check('C at 07:55, leaving at 12:00 on a shift ending 14:00, is present with an EARLY LEAVE', cRow, 'present|early_leave');
const cAbsent = psql(`select status || '|' || coalesce(check_in_at::text,'none') from public.attendance where member_id='${members.C}' and date='${days[1]}'`);
check('C with no check-in is absent, with no time', cAbsent, 'absent|none');
// The instant is the Cairo wall clock, not UTC: 08:30 Cairo is 05:30Z or 06:30Z
// depending on the season, and either way its Cairo clock reads 08:30.
check('the stored instant reads 08:30 in Cairo',
  psql(`select to_char(check_in_at at time zone 'Africa/Cairo', 'HH24:MI') from public.attendance where member_id='${members.B}' and date='${days[1]}'`), '08:30');

// The month's numbers moved the way the rows say: B's absence became a late
// arrival (+1 attended, +1 late, -1 absent) and C came once (+1 attended).
const after = await stats(pastYear, pastMonth);
check('the settled month now counts 9 attended', after.body?.attended, 9);
check('  3 of them late', after.body?.late, 3);
check('  and 3 absent', after.body?.absent, 3);

check('the import left one audit row',
  ((await call('GET', '/audit?event=attendance_imported', { token: suToken })).body?.rows ?? []).length >= 1, true);

wipe();

process.exit(report() ? 0 : 1);
