// Every fixed value the API reasons about, in one place.
//
// WHAT BELONGS HERE
//
// A constant that more than one module reads, or that somebody would come
// looking for in order to change it: page sizes, retention windows, report
// colours, the clock's timezone, the dimensions of a face embedding.
//
// WHAT DOES NOT
//
// A number that is part of a formula and meaningless outside it. WGS84's
// semi-major axis is below because the geofence and anything else doing geodesy
// must agree on it — but a local like `1 - e2 * sin²` stays inside the function
// it describes. Splitting a formula across two files to satisfy a rule about
// where constants live makes the formula harder to check, not easier.
//
// Nothing here reads the environment. Values that an operator sets per
// deployment are in env.ts, validated on start; these are decisions the code
// makes and does not vary.
// ---------------------------------------------------------------- time
export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
/** Minutes in a day. Named because it stands for three different ideas in the
 *  shift-window arithmetic: a wrap point, a day length, and a rollover. */
export const MINUTES_PER_DAY = 1440;
/**
 * The one timezone this system reasons in.
 *
 * Egypt observes daylight saving again since 2023, so "UTC+2" is wrong for
 * roughly half the academic year. The offset is never assumed anywhere; it is
 * always derived from this zone.
 */
export const APP_TIMEZONE = 'Africa/Cairo';
// ---------------------------------------------------------------- auth
/**
 * The `aud` claim. Changing it invalidates access tokens minted before the
 * change — which costs each client one 401 and a silent refresh, not a sign-out.
 */
export const TOKEN_AUDIENCE = 'intern-attendance';
/**
 * bcrypt cost. Must match anything else that writes a hash (scripts/seed-
 * superadmin.mjs), or an account created by one cannot be verified by the other.
 */
export const BCRYPT_COST = 10;
/**
 * How short a password may be.
 *
 * `PASSWORD_MIN` is the floor for an ordinary account, which a member types on a
 * phone at the start of every shift.
 *
 * `MASTER_PASSWORD_MIN` is higher because the master password is a different
 * kind of thing: one string that opens EVERY admin account, set once by a
 * superadmin and typed rarely. There was no floor on it at all — a one-character
 * master key was accepted — and nothing about how it is used argues for making
 * it easy to type. Raise or lower it here; nothing else states a number.
 */
export const PASSWORD_MIN = 6;
export const MASTER_PASSWORD_MIN = 12;
/**
 * The account created when a database has no superadmin at all.
 *
 * WHY A FIXED NATIONAL ID AND A GENERATED PASSWORD
 *
 * A national id is a username: knowing it grants nothing, and a predictable one
 * means the recovery story is "sign in as this, with the password we printed".
 * The PASSWORD is the secret, so it is generated per installation rather than
 * being a default anybody could look up in this repository.
 *
 * The date encoded in it (28/10/2001) is only what the national id format
 * carries; nothing in the system reads a date of birth off this account.
 */
export const FIRST_SUPERADMIN = {
    nationalId: '30110281500753',
    fullName: 'Super Admin',
};
/**
 * Bytes of randomness behind the generated first password.
 *
 * 24 bytes is 32 base64url characters — far past anything guessable, and still
 * short enough to read off a terminal and type once.
 */
export const FIRST_SUPERADMIN_PASSWORD_BYTES = 24;
/** Where the generated password is written, relative to the process's cwd. */
export const FIRST_SUPERADMIN_FILE = 'first-superadmin.txt';
// ---------------------------------------------------------------- paging
/**
 * Largest page any listing endpoint will serve.
 *
 * A PAGE SIZE, and nothing else: exports do not page (see the `/export` routes),
 * so this no longer has to be large enough to hold a whole report. It REJECTS
 * rather than clamps — silently returning fewer rows than asked for is how a
 * caller loops forever, or stops early believing it saw everything.
 */
export const MAX_PAGE_SIZE = 200;
// ---------------------------------------------------------------- biometrics
/** Fixed by the face model the client runs. */
export const EMBEDDING_DIM = 512;
// ---------------------------------------------------------------- geodesy
/** Degrees to radians. */
export const DEG = Math.PI / 180;
/** WGS84 semi-major axis, metres. */
export const WGS84_A = 6378137.0;
/** WGS84 first eccentricity squared — f(2 − f). */
export const WGS84_E2 = 6.694379990141316e-3;
/**
 * How far outside a boundary still counts as inside, in metres.
 *
 * A millimetre. It exists so a point ON an edge is not decided by floating-point
 * noise — not to be generous about the geofence.
 */
export const BOUNDARY_TOLERANCE_M = 1e-3;
// ------------------------------------------------------- shift windows
/** How long before the late boundary check-in opens, when a shift does not say. */
export const DEFAULT_CHECKIN_LEAD_MIN = 30;
/** How long check-out stays open after it opens, when a shift does not say. */
export const DEFAULT_CHECKOUT_SPAN_MIN = 180;
// ---------------------------------------------------------------- reports
/**
 * Typeface per language.
 *
 * Cairo for Arabic and Inter for Latin. Both are named with a full fallback
 * chain, because a generated file is opened on a machine this server knows
 * nothing about — and a missing font must degrade to something that still
 * renders Arabic, not to a default that renders boxes.
 */
export const REPORT_FONT = {
    ar: 'Cairo',
    en: 'Inter',
    /** Where the print stylesheet fetches them from when the viewer is online. */
    webfontHref: 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Inter:wght@400;600;700&display=swap',
    /** Used when neither is installed and there is no network. */
    fallback: "'Segoe UI', Tahoma, Arial, sans-serif",
};
/** Brand palette — mirrors ClientApp/src/lib/colors.ts. */
export const REPORT_PALETTE = {
    accent: '#0d9488',
    accentDark: '#0f766e',
    hairline: '#d0d5db',
    stripe: '#f3faf9',
    muted: '#98a2b3',
    text: '#111111',
    white: '#ffffff',
};
/**
 * Cell backgrounds per attendance status, matching the badges on screen.
 *
 * The MARK beside each is what makes a printed or colour-blind-safe copy still
 * readable: the fill carries the meaning at a glance, the mark carries it
 * absolutely.
 */
export const STATUS_STYLE = {
    present: { fill: '#dcfce7', mark: '✓' },
    late: { fill: '#fef9c3', mark: '!' },
    early_leave: { fill: '#fef9c3', mark: '↩' },
    absent: { fill: '#fee2e2', mark: '✗' },
    left_work: { fill: '#f3e8ff', mark: '⇥' },
    pending: { fill: '#dbeafe', mark: '·' },
};
/**
 * Worst-first. A day holding both a `present` and an `absent` reads as ABSENT,
 * because the cell exists to make a problem visible — showing the good half of
 * a mixed day hides exactly the case somebody is looking for.
 */
export const STATUS_SEVERITY = [
    'absent',
    'late',
    'left_work',
    'early_leave',
    'pending',
    'present',
];
/** `present` and `late` both mean the member turned up. */
export const ATTENDED_STATUSES = ['present', 'late'];
/** Excel rejects these in a sheet name, and caps the name at 31 characters. */
export const SHEET_NAME_ILLEGAL = /[*?:\\/[\]]/g;
export const SHEET_NAME_MAX = 31;
export const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
// ---------------------------------------------------------------- storage
/**
 * The kinds of file this system stores, and everything that differs between
 * them.
 *
 * ONE TABLE, NOT THREE LISTS. These properties used to live apart — an enum of
 * names, a separate set of which ones were readable without a signature, and a
 * special case inside the access rule for where an avatar's owner comes from.
 * Three places to edit to add a kind, and nothing to catch you if you edited
 * two.
 *
 *   signedUrl   false only for avatars: a profile picture appears beside a name
 *               in lists a signed-out caller already sees, and signing each one
 *               would mean a round trip per face in a grid. Everything else is
 *               biometric and every read is signed.
 *
 *   ownerFrom   'subject' reads attachments.subject_id — who the file is ABOUT,
 *               which is not who uploaded it (an admin enrols a member's face).
 *               'path' is for avatars only, where the path genuinely IS
 *               `<profile-id>.<ext>` and that is the whole layout.
 */
export const FILE_KINDS = {
    faces: { signedUrl: true, ownerFrom: 'subject' },
    probes: { signedUrl: true, ownerFrom: 'subject' },
    avatars: { signedUrl: false, ownerFrom: 'path' },
};
/** For the schema's CHECK and for validating a path parameter. */
export const FILE_KIND_NAMES = Object.keys(FILE_KINDS);
/**
 * Who may do what, per kind.
 *
 *   own       the caller is who the file is about
 *   staff     an admin or superadmin
 *   anyone    no check at all
 *
 * `probes` and `faces` give staff NO write. An admin enrolling someone else's
 * face goes through the privileged server-side path, which is audited — not
 * through a client-supplied path. And a probe is EVIDENCE: the capture taken at
 * a check-in, which nobody should be able to rewrite afterwards.
 */
export const FILE_ACCESS = {
    faces: { read: 'own-or-staff', write: 'own', delete: 'staff' },
    probes: { read: 'own-or-staff', write: 'own', delete: 'staff' },
    avatars: { read: 'anyone', write: 'own-or-staff', delete: 'own-or-staff' },
};
// ------------------------------------------------------- attendance outcomes
/**
 * How each outcome is shown — and the source of every legend.
 *
 * `mark` carries the meaning absolutely, `fill` carries it at a glance. Both
 * exist because an export is printed, photocopied and read by people who cannot
 * separate the greens from the reds; a colour alone is decoration.
 *
 * `labelKey` is a translation key rather than text, so a legend reads in the
 * language the report was asked for.
 *
 * ANYTHING THAT DISPLAYS ATTENDANCE RENDERS FROM HERE, including the legend
 * itself — so a legend cannot describe a mark nobody uses, or miss one in use.
 */
export const ATTENDANCE_OUTCOME = {
    off: { mark: '–', fill: '#f3f4f6', labelKey: 'outcome.off' },
    upcoming: { mark: '·', fill: '#dbeafe', labelKey: 'outcome.upcoming' },
    absent: { mark: '✗', fill: '#fee2e2', labelKey: 'outcome.absent' },
    present_open: { mark: '✓', fill: '#dcfce7', labelKey: 'outcome.present_open' },
    present_out: { mark: '✓✓', fill: '#bbf7d0', labelKey: 'outcome.present_out' },
    present_early: { mark: '✓↩', fill: '#fef9c3', labelKey: 'outcome.present_early' },
    present_left: { mark: '✓⇥', fill: '#f3e8ff', labelKey: 'outcome.present_left' },
    late_open: { mark: '!', fill: '#fef08a', labelKey: 'outcome.late_open' },
    late_out: { mark: '!✓', fill: '#fde68a', labelKey: 'outcome.late_out' },
    late_early: { mark: '!↩', fill: '#fed7aa', labelKey: 'outcome.late_early' },
    late_left: { mark: '!⇥', fill: '#e9d5ff', labelKey: 'outcome.late_left' },
};
/** Legend order: the good outcomes, then the partial ones, then the failures. */
export const OUTCOME_LEGEND_ORDER = [
    'present_out',
    'present_open',
    'late_out',
    'late_open',
    'present_early',
    'late_early',
    'present_left',
    'late_left',
    'absent',
    'upcoming',
    'off',
];
// ---------------------------------------------------------------------------
// Wire names -> schema names
// ---------------------------------------------------------------------------
/**
 * The API speaks snake_case. The schema's TypeScript names are camelCase.
 *
 * Those two facts are fine on their own and lethal together, because Drizzle
 * DROPS a `.set()` key it does not recognise instead of refusing it — so a patch
 * built straight from a request body writes nothing and reports success. See
 * infrastructure/database/patch.types.ts.
 *
 * Every member field a client may patch is translated here, once. The map is
 * checked against the real column names where it is used, so a typo or a renamed
 * column fails the build rather than a Tuesday.
 */
export const MEMBER_COLUMN = {
    group_id: 'groupId',
    branch_id: 'branchId',
    is_active: 'isActive',
    bypass_face: 'bypassFace',
    bypass_location: 'bypassLocation',
    bypass_checkout_window: 'bypassCheckoutWindow',
    frozen_at: 'frozenAt',
    can_generate_qr: 'canGenerateQr',
    can_make_roster: 'canMakeRoster',
    can_reset_face: 'canResetFace',
};
/** The patchable wire names, as a list to iterate. */
export const MEMBER_FIELDS = Object.keys(MEMBER_COLUMN);
// ---------------------------------------------------------------------------
// Admin privileges
// ---------------------------------------------------------------------------
/**
 * Every page a superadmin can grant, then the four only a superadmin ever sees.
 *
 * These are the client's route names, which is why the list lives in both
 * projects — but the server is where a grant is stored, so it is the server that
 * decides which names are real. Anything else is rejected at the door instead of
 * being written into a jsonb column and never matching a page again.
 */
export const ADMIN_PAGES = [
    'dashboard',
    'groups',
    'branches',
    'members',
    'rosters',
    'review',
    'audit',
    'presence',
    'faceTest',
    'faceImages',
    'memberLookup',
    'shifts',
    'departments',
    'admins',
    'settings',
];
/** What a grant may allow on a page. Reading is implied by having the page. */
export const ADMIN_OPS = ['create', 'edit', 'delete', 'export'];
//# sourceMappingURL=constants.js.map