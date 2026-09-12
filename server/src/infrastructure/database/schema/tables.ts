import { pgTable, unique, uuid, text, timestamp, jsonb, foreignKey, boolean, bigint, index, uniqueIndex, real, check, doublePrecision, integer, date, time, pgView, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { FILE_KIND_NAMES } from "../../../config/constants.js"
import type { JsonObject, JsonValue } from "../../../common/json.types.js"
import type { LatLngRing } from "../../../domain/attendance/types.js"
import type { AdminPermissions } from "../../../domain/identity/types.js"
import { CheckoutStatus } from "../../../common/enums/index.js"

// The models. EDIT THESE — they are the source of truth for tables, columns,
// indexes, foreign keys, constraints, enums and views, and `npm run db:generate`
// writes the migration for whatever changes here.
//
// Nothing edits the database by hand, so nothing needs to be read back from it.
// The migration files are output, not input.

export const attendanceStatus = pgEnum("attendance_status", ['present', 'late', 'early_leave', 'absent', 'left_work'])
// Every event the API writes has a value here, and the enum is what keeps that
// true: an event name with no value fails the insert rather than being
// recorded as free text nobody can group by —
// `checkout_blocked` from the recorder — but the enum never had them, so every
// one of those audit inserts raised and was swallowed by a bare catch. No
// master-password login and no time-window refusal was ever recorded.
export const auditEvent = pgEnum("audit_event", ['login', 'password_changed', 'face_enrolled', 'mock_location_detected', 'out_of_range', 'low_accuracy', 'face_mismatch', 'liveness_failed', 'integrity_failed', 'check_in', 'check_out', 'master_login', 'staff_deleted', 'member_lookup_out_of_scope', 'outside_window', 'checkout_blocked', 'server_error', 'superadmin_backup', 'superadmin_restore'])
export const enrollmentStatus = pgEnum("enrollment_status", ['pending', 'enrolled'])
export const role = pgEnum("role", ['superadmin', 'admin', 'member'])


// There is ONE store of credentials: profiles.password_hash.
//
// The previous platform kept staff hashes in its own auth service's user table
// and members' in profiles, both plain bcrypt — two stores of the same format,
// so every password operation had two code paths that had to agree. Migration
// 0002 folded them together and dropped the other table.
//
// Its identity helpers went the same way: they read the caller from a session
// variable, which only made sense while the browser talked to the database
// directly. Identity is a parameter now, from the JWT the guard verified. See

export const profiles = pgTable("profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	role: role().default('member').notNull(),
	fullName: text("full_name").notNull(),
	nationalId: text("national_id").notNull(),
	phone: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	permissions: jsonb().$type<AdminPermissions>(),
	email: text(),
	passwordHash: text("password_hash"),
	avatarUrl: text("avatar_url"),
}, (table) => [
	// The self-reference below is a foreign key like any other: deleting a
	// profile has to find every row that named it as its creator, and that is a
	// scan of `profiles` itself without this.
	index("profiles_created_by_idx").using("btree", table.createdBy.asc().nullsLast()),
	// Self-referencing: the admin who created this account. It pointed at
	// auth.users(id) with NO delete rule, which meant deleting an admin who had
	// ever created an account failed with a foreign key violation — the one
	// case where DELETE /auth/staff/:id could not work. SET NULL: the account
	// outlives whoever made it.
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [table.id],
			name: "profiles_created_by_fkey"
		}).onDelete("set null"),
	unique("profiles_national_id_key").on(table.nationalId),
]);

// ---------------------------------------------------------------------------
// Refresh tokens.
//
// Sessions are two tokens: a short-lived access JWT the API verifies by
// signature alone, and a long-lived refresh token that lives HERE.
//
// The split is what makes a session revocable. A signed token cannot be taken
// back — whoever holds it is authenticated until it expires — so the access
// token is kept short and every renewal goes through this table, where the
// database can answer "is this session still allowed?" and say no.
//
// WHAT EACH COLUMN IS FOR
//
//   token_hash  SHA-256, not bcrypt. The token is 32 random bytes, so there is
//               no password to slow an attacker down to — a fast hash is right,
//               and a slow one would put a KDF on the hot path of every renewal.
//   family_id   All the tokens descended from one sign-in. Rotation replaces a
//               token; the family is what gets revoked when one is replayed.
//   rotated_at  Set when this token is exchanged. A token presented AFTER this
//               is set has been used twice, which the holder cannot do by
//               accident — so the whole family dies. That is the standard
//               reuse-detection rule, and it is the reason rotation is worth
//               anything at all.
// ---------------------------------------------------------------------------
export const refreshTokens = pgTable("refresh_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	familyId: uuid("family_id").notNull(),
	tokenHash: text("token_hash").notNull(),
	issuedAt: timestamp("issued_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	rotatedAt: timestamp("rotated_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	// Truncated, and only to let someone recognise their own devices on a
	// "signed-in elsewhere" screen. Never used for a decision.
	userAgent: text("user_agent"),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "refresh_tokens_profile_id_fkey"
		}).onDelete("cascade"),
	// The lookup every renewal does, and the constraint that makes a duplicated
	// hash impossible rather than merely unlikely.
	unique("refresh_tokens_token_hash_key").on(table.tokenHash),
	index("refresh_tokens_family_idx").using("btree", table.familyId.asc().nullsLast()),
	index("refresh_tokens_profile_idx").using("btree", table.profileId.asc().nullsLast()),
	index("refresh_tokens_expires_idx").using("btree", table.expiresAt.asc().nullsLast()),
]);

// File metadata lives in public.attachments below.
//
// It used to live in a storage service's own two tables. This app used two
// columns of the first (id, public) to describe three fixed values — they are
// constants in src/infrastructure/storage now, which nothing at runtime can
// write to — and the second as a plain file index, which is what attachments
// is.
//
// `public.attachments` is that index, said plainly: which file, in which
// kind, how big, what type, who uploaded it.

export const attachments = pgTable("attachments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	// Deliberately not a foreign key: there is no kinds TABLE. The three kinds
	// and which of them is public are code (src/storage/objects.ts), because
	// they are a deployment fact, not data anyone edits. The check constraint is
	// what a foreign key was actually buying.
	kind: text().notNull(),
	path: text().notNull(),
	// Who uploaded it. NOT what decides access: a face photo is uploaded BY an
	// admin on behalf of someone else.
	ownerId: uuid("owner_id"),
	// WHO THE FILE IS ABOUT, which is what decides access.
	//
	// Recorded, never inferred from the path. Deriving ownership by parsing a
	// storage path couples an access decision to a directory layout: reorganise
	// the tree for humans and the parser quietly stops matching anybody, which
	// fails closed and looks like a permissions bug nobody can reproduce.
	//
	// With it recorded, the layout is free to be readable — see
	// infrastructure/storage/paths.ts — and access is a column comparison.
	subjectId: uuid("subject_id"),
	byteSize: bigint("byte_size", { mode: "number" }).default(0).notNull(),
	contentType: text("content_type").default('application/octet-stream').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	// Generated from FILE_KINDS (config/constants.ts), so the database cannot
	// accept a kind the application does not know — nor reject one it does. This
	// drifted before: the constraint allowed three values while the code carried
	// five, and the two it did not allow were never caught because nothing ever
	// wrote them.
	// Every stored file points at its owner; a profile delete SET NULLs them.
	index("attachments_owner_idx").using("btree", table.ownerId.asc().nullsLast()),
	check("attachments_kind_check", sql.raw(`kind in (${FILE_KIND_NAMES.map((k) => `'${k}'`).join(', ')})`)),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [profiles.id],
			name: "attachments_owner_id_fkey"
		}).onDelete("set null"),
	// The lookup every read does: kind + path. Unique because a path IS the
	// identity of a file on disk — two rows for one file would let a delete
	// leave a live row pointing at nothing.
	unique("attachments_kind_path_key").on(table.kind, table.path),
]);
export const members = pgTable("members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	groupId: uuid("group_id").notNull(),
	branchId: uuid("branch_id").notNull(),
	enrollmentStatus: enrollmentStatus("enrollment_status").default('pending').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	bypassFace: boolean("bypass_face").default(false).notNull(),
	bypassLocation: boolean("bypass_location").default(false).notNull(),
	frozenAt: timestamp("frozen_at", { withTimezone: true, mode: 'string' }),
	canGenerateQr: boolean("can_generate_qr").default(false).notNull(),
	locationBypassUntil: timestamp("location_bypass_until", { withTimezone: true, mode: 'string' }),
	canMakeRoster: boolean("can_make_roster").default(false).notNull(),
	bypassCheckoutWindow: boolean("bypass_checkout_window").default(false).notNull(),
	canResetFace: boolean("can_reset_face").default(false).notNull(),
	memberCode: text("member_code"),
}, (table) => [
	index("members_group_idx").using("btree", table.groupId.asc().nullsLast()),
	index("members_branch_idx").using("btree", table.branchId.asc().nullsLast()),
	uniqueIndex("members_member_code_key").using("btree", table.memberCode.asc().nullsLast()).where(sql`(member_code IS NOT NULL)`),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "members_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [groups.id],
			name: "members_group_id_fkey"
		}),
	foreignKey({
			columns: [table.branchId],
			foreignColumns: [branches.id],
			name: "members_branch_id_fkey"
		}),
	unique("members_profile_id_key").on(table.profileId),
]);

export const faceTemplates = pgTable("face_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	memberId: uuid("member_id").notNull(),
	// A plain float array, so the database needs no vector extension and can be
	// created by an ordinary role. The comparison is one template against one
	// probe, in src/domain/face/similarity.ts — see that file for when a vector
	// index would actually start to earn its setup cost.
	embedding: real().array().notNull(),
	photoPath: text("photo_path"),
	qualityScore: real("quality_score"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "face_templates_intern_id_fkey"
		}).onDelete("cascade"),
	unique("face_templates_intern_id_key").on(table.memberId),
]);

export const branches = pgTable("branches", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	address: text(),
	latitude: doublePrecision().notNull(),
	longitude: doublePrecision().notNull(),
	radiusMeters: integer("radius_meters").default(150).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	bypassFace: boolean("bypass_face").default(false).notNull(),
	bypassLocation: boolean("bypass_location").default(false).notNull(),
	institutionId: uuid("institution_id"),
	areaCoords: jsonb("area_coords").$type<LatLngRing>(),
	qrEnabled: boolean("qr_enabled").default(true).notNull(),
	blockCheckin: boolean("block_checkin").default(false).notNull(),
	requireQr: boolean("require_qr").default(false).notNull(),
	bypassCheckoutWindow: boolean("bypass_checkout_window").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.institutionId],
			foreignColumns: [institutions.id],
			name: "branches_institution_id_fkey"
		}).onDelete("set null"),
	check("branches_radius_meters_check", sql`(radius_meters >= 20) AND (radius_meters <= 5000)`),
]);

export const groups = pgTable("groups", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	year: integer().notNull(),
	startDate: date("start_date"),
	endDate: date("end_date"),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	bypassFace: boolean("bypass_face").default(false).notNull(),
	bypassLocation: boolean("bypass_location").default(false).notNull(),
	institutionCode: integer("institution_code").default(1).notNull(),
	institutionName: text("institution_name"),
	institutionId: uuid("institution_id"),
	branchId: uuid("branch_id"),
	bypassCheckoutWindow: boolean("bypass_checkout_window").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.institutionId],
			foreignColumns: [institutions.id],
			name: "groups_institution_id_fkey"
		}),
	foreignKey({
			columns: [table.branchId],
			foreignColumns: [branches.id],
			name: "groups_branch_id_fkey"
		}).onDelete("set null"),
	check("groups_year_width_check", sql`(year >= 1000) AND (year <= 9999)`),
]);

export const rosterDays = pgTable("roster_days", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	memberId: uuid("member_id").notNull(),
	date: date().notNull(),
	shiftId: uuid("shift_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("roster_days_intern_date_idx").using("btree", table.memberId.asc().nullsLast(), table.date.asc().nullsLast()),
	// A filter on date ALONE — which the daily-roster view does — cannot use the
	// composite above, because date is its second column. Confirmed with EXPLAIN:
	// roster_days took a Seq Scan where attendance, which has this index, took an
	// Index Scan for the identical query. The table grows at members x teaching
	// days, roughly 110k rows a year for 300 students.
	index("roster_days_shift_idx").using("btree", table.shiftId.asc().nullsLast()),
	index("roster_days_date_idx").using("btree", table.date.asc().nullsLast()),
	uniqueIndex("roster_days_intern_date_shift_key").using("btree", table.memberId.asc().nullsLast(), table.date.asc().nullsLast(), table.shiftId.asc().nullsLast()),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "roster_days_intern_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.shiftId],
			foreignColumns: [shifts.id],
			name: "roster_days_shift_id_fkey"
		}).onDelete("cascade"),
]);

export const adminAssignments = pgTable("admin_assignments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	adminId: uuid("admin_id").notNull(),
	groupId: uuid("group_id"),
	branchId: uuid("branch_id"),
}, (table) => [
	index("admin_assignments_admin_idx").using("btree", table.adminId.asc().nullsLast()),
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [profiles.id],
			name: "admin_assignments_admin_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [groups.id],
			name: "admin_assignments_batch_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.branchId],
			foreignColumns: [branches.id],
			name: "admin_assignments_hospital_id_fkey"
		}).onDelete("cascade"),
	check("admin_assignments_check", sql`(group_id IS NOT NULL) OR (branch_id IS NOT NULL)`),
]);

export const auditLog = pgTable("audit_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorId: uuid("actor_id"),
	event: auditEvent().notNull(),
	// Typed at the column, so every reader gets JsonValue instead of drizzle's
	// bare `{}` — which is assignable to nothing useful and forces a cast per
	// call site, each one a place to assert the wrong shape.
	detail: jsonb().$type<JsonValue>(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	// THE EXPENSIVE ONE. Deleting a profile SET NULLs its audit rows, and the
	// trail keeps a year — without this the delete scans all of it.
	index("audit_log_actor_idx").using("btree", table.actorId.asc().nullsLast()),
	index("audit_log_created_idx").using("btree", table.createdAt.desc().nullsFirst()),
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [profiles.id],
			name: "audit_log_actor_id_fkey"
		}).onDelete("set null"),
]);

export const attendance = pgTable("attendance", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	memberId: uuid("member_id").notNull(),
	branchId: uuid("branch_id").notNull(),
	date: date().notNull(),
	status: attendanceStatus().default('present').notNull(),
	checkInAt: timestamp("check_in_at", { withTimezone: true, mode: 'string' }),
	checkInLat: doublePrecision("check_in_lat"),
	checkInLng: doublePrecision("check_in_lng"),
	checkInAccuracyM: real("check_in_accuracy_m"),
	checkInDistanceM: real("check_in_distance_m"),
	checkInFaceScore: real("check_in_face_score"),
	checkInLivenessPassed: boolean("check_in_liveness_passed"),
	checkInIsMock: boolean("check_in_is_mock"),
	checkInProbePath: text("check_in_probe_path"),
	checkOutAt: timestamp("check_out_at", { withTimezone: true, mode: 'string' }),
	checkOutLat: doublePrecision("check_out_lat"),
	checkOutLng: doublePrecision("check_out_lng"),
	checkOutAccuracyM: real("check_out_accuracy_m"),
	checkOutDistanceM: real("check_out_distance_m"),
	checkOutFaceScore: real("check_out_face_score"),
	checkOutLivenessPassed: boolean("check_out_liveness_passed"),
	checkOutIsMock: boolean("check_out_is_mock"),
	checkOutProbePath: text("check_out_probe_path"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	shiftId: uuid("shift_id"),
	shiftName: text("shift_name"),
	checkInBypass: jsonb("check_in_bypass").$type<JsonObject>(),
	checkOutBypass: jsonb("check_out_bypass").$type<JsonObject>(),
	checkoutStatus: text("checkout_status"),
}, (table) => [
	// `status` is an enum and the database enforces it; `checkout_status` was a
	// bare text column accepting any string at all — a typo in a scheduler update
	// would have been stored and then quietly failed to match anything for the
	// rest of the row's life. Generated from the CheckoutStatus enum so the two
	// cannot drift, and NULL stays legal: it is what "has not checked out" means.
	check(
		"attendance_checkout_status_check",
		sql.raw(
			`checkout_status is null or checkout_status in (${Object.values(CheckoutStatus)
				.map((v) => `'${v}'`)
				.join(', ')})`,
		),
	),
	// A shift delete CASCADEs through attendance, which is the largest table.
	index("attendance_shift_idx").using("btree", table.shiftId.asc().nullsLast()),
	index("attendance_date_idx").using("btree", table.date.asc().nullsLast()),
	index("attendance_hospital_date_idx").using("btree", table.branchId.asc().nullsLast(), table.date.asc().nullsLast()),
	uniqueIndex("attendance_intern_date_shift_key").using("btree", table.memberId.asc().nullsLast(), table.date.asc().nullsLast(), table.shiftId.asc().nullsLast()),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "attendance_intern_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.branchId],
			foreignColumns: [branches.id],
			name: "attendance_hospital_id_fkey"
		}),
	foreignKey({
			columns: [table.shiftId],
			foreignColumns: [shifts.id],
			name: "attendance_shift_id_fkey"
		}).onDelete("cascade"),
]);

export const qrTokens = pgTable("qr_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	token: text().notNull(),
	branchId: uuid("branch_id").notNull(),
	date: date().notNull(),
	memberId: uuid("member_id"),
	singleUse: boolean("single_use").default(false).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("qr_tokens_member_idx").using("btree", table.memberId.asc().nullsLast()),
	index("qr_tokens_branch_idx").using("btree", table.branchId.asc().nullsLast()),
	index("qr_tokens_expires_at_idx").using("btree", table.expiresAt.asc().nullsLast()),
	index("qr_tokens_token_idx").using("btree", table.token.asc().nullsLast()),
	foreignKey({
			columns: [table.branchId],
			foreignColumns: [branches.id],
			name: "qr_tokens_hospital_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "qr_tokens_intern_id_fkey"
		}).onDelete("cascade"),
	unique("qr_tokens_token_key").on(table.token),
]);

export const appSettings = pgTable("app_settings", {
	id: integer().default(1).primaryKey().notNull(),
	faceMatchThreshold: real("face_match_threshold").default(0.65).notNull(),
	livenessRequired: boolean("liveness_required").default(true).notNull(),
	defaultRadiusMeters: integer("default_radius_meters").default(150).notNull(),
	maxAccuracyMeters: integer("max_accuracy_meters").default(50).notNull(),
	shiftStart: time("shift_start").default('07:00:00').notNull(),
	shiftEnd: time("shift_end").default('17:00:00').notNull(),
	lateGraceMinutes: integer("late_grace_minutes").default(30).notNull(),
	requirePlayIntegrity: boolean("require_play_integrity").default(false).notNull(),
	bypassFace: boolean("bypass_face").default(false).notNull(),
	bypassLocation: boolean("bypass_location").default(false).notNull(),
	storeFaceImages: boolean("store_face_images").default(false).notNull(),
	qrRequiresMember: boolean("qr_requires_member").default(false).notNull(),
	qrValiditySeconds: integer("qr_validity_seconds").default(25).notNull(),
	qrBypassMinutes: integer("qr_bypass_minutes").default(30).notNull(),
	enforceShiftWindow: boolean("enforce_shift_window").default(false).notNull(),
	allowCheckoutOnly: boolean("allow_checkout_only").default(false).notNull(),
	autoLeaveWork: boolean("auto_leave_work").default(false).notNull(),
	orgName: text("org_name"),
	orgLogoUrl: text("org_logo_url"),
	terminology: text().default('generic').notNull(),
	masterPasswordHash: text("master_password_hash"),
	memberPhotos: boolean("member_photos").default(true).notNull(),
	showOutOfRangeMap: boolean("show_out_of_range_map").default(true).notNull(),
	blockDevOptions: boolean("block_dev_options").default(true).notNull(),
	locationIpMaxKm: integer("location_ip_max_km").default(100).notNull(),
	webDetectFrozenGps: boolean("web_detect_frozen_gps").default(false).notNull(),
	checkinMethod: text("checkin_method").default('both').notNull(),
	bypassCheckoutWindow: boolean("bypass_checkout_window").default(false).notNull(),
	livenessMode: text("liveness_mode").default('turn').notNull(),
	qrAllowImage: boolean("qr_allow_image").default(true).notNull(),
	// Both of these are read with a default on the far side (`Boolean(...)`,
	// `?? 3`), which means a missing column does not raise — it silently becomes
	// the default and the admin screen shows a setting that does nothing. They
	// are declared here so the model and the reader cannot drift apart.
	//
	// THE DEFAULTS PRESERVE TODAY'S BEHAVIOUR EXACTLY, which is the whole point
	// of adding them this way: `false` is what the undefined column already
	// evaluated to, and `3` is the fallback the client already used. Nothing
	// starts happening because these columns now exist.
	//
	// Turning probe storage ON is a deliberate act with real consequences — it
	// keeps a face capture per check-in per student — so it stays an admin
	// decision about retention, not a side effect of a schema fix.
	storeProbeImages: boolean("store_probe_images").default(false).notNull(),
	captureHoldSeconds: integer("capture_hold_seconds").default(3).notNull(),
}, (table) => [
	check("app_settings_id_check", sql`id = 1`),
	check("app_settings_checkin_method_check", sql`checkin_method = ANY (ARRAY['location'::text, 'qr'::text, 'both'::text, 'none'::text])`),
	check("app_settings_liveness_mode_check", sql`liveness_mode = ANY (ARRAY['action'::text, 'turn'::text, 'both'::text])`),
]);

export const shifts = pgTable("shifts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	startTime: time("start_time").notNull(),
	endTime: time("end_time").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	key: text(),
	lateGraceMinutes: integer("late_grace_minutes").default(15).notNull(),
	lateFrom: time("late_from"),
	lateTo: time("late_to"),
	checkinOpen: time("checkin_open"),
	checkinLate: time("checkin_late"),
	checkinClose: time("checkin_close"),
	checkoutOpen: time("checkout_open"),
	checkoutClose: time("checkout_close"),
}, (table) => [
	uniqueIndex("shifts_key_unique").using("btree", sql`lower(key)`).where(sql`(key IS NOT NULL)`),
]);

export const departments = pgTable("departments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	branchId: uuid("branch_id"),
}, (table) => [
	foreignKey({
			columns: [table.branchId],
			foreignColumns: [branches.id],
			name: "departments_hospital_id_fkey"
		}).onDelete("cascade"),
]);

export const memberDepartments = pgTable("member_departments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	memberId: uuid("member_id").notNull(),
	year: integer().notNull(),
	month: integer().notNull(),
	departmentId: uuid("department_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("member_departments_department_idx").using("btree", table.departmentId.asc().nullsLast()),
	index("member_departments_month_idx").using("btree", table.year.asc().nullsLast(), table.month.asc().nullsLast()),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "member_departments_intern_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "member_departments_department_id_fkey"
		}).onDelete("cascade"),
	unique("member_departments_intern_id_year_month_key").on(table.memberId, table.year, table.month),
]);

export const institutions = pgTable("institutions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	code: integer().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("institutions_code_width_check", sql`(code >= 0) AND (code <= 99)`),
]);

export const presenceChecks = pgTable("presence_checks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdBy: uuid("created_by"),
	branchId: uuid("branch_id"),
	groupId: uuid("group_id"),
	departmentId: uuid("department_id"),
	shiftId: uuid("shift_id"),
	date: date().notNull(),
	deadline: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	targetMemberIds: uuid("target_member_ids").array().default([]).notNull(),
	status: text().default('open').notNull(),
	decision: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	// A check names a branch, group, shift and department; deleting any of them
	// has to find the checks that referenced it.
	index("presence_checks_branch_idx").using("btree", table.branchId.asc().nullsLast()),
	index("presence_checks_group_idx").using("btree", table.groupId.asc().nullsLast()),
	index("presence_checks_shift_idx").using("btree", table.shiftId.asc().nullsLast()),
	index("presence_checks_department_idx").using("btree", table.departmentId.asc().nullsLast()),
	index("presence_checks_creator_idx").using("btree", table.createdBy.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	index("presence_checks_open_idx").using("btree", table.status.asc().nullsLast(), table.deadline.asc().nullsLast()),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.id],
			name: "presence_checks_created_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.branchId],
			foreignColumns: [branches.id],
			name: "presence_checks_branch_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [groups.id],
			name: "presence_checks_group_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "presence_checks_department_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.shiftId],
			foreignColumns: [shifts.id],
			name: "presence_checks_shift_id_fkey"
		}).onDelete("set null"),
	check("presence_checks_status_check", sql`status = ANY (ARRAY['open'::text, 'resolved'::text, 'cancelled'::text])`),
	check("presence_checks_decision_check", sql`decision = ANY (ARRAY['left_work'::text, 'keep'::text])`),
]);

export const presenceConfirmations = pgTable("presence_confirmations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	checkId: uuid("check_id").notNull(),
	memberId: uuid("member_id").notNull(),
	confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.checkId],
			foreignColumns: [presenceChecks.id],
			name: "presence_confirmations_check_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.memberId],
			foreignColumns: [members.id],
			name: "presence_confirmations_member_id_fkey"
		}).onDelete("cascade"),
	// Deleting a member CASCADEs here; the unique below leads with check_id, so
	// it cannot serve a lookup by member.
	index("presence_confirmations_member_idx").using("btree", table.memberId.asc().nullsLast()),
	unique("presence_confirmations_check_id_member_id_key").on(table.checkId, table.memberId),
]);
export const memberDirectory = pgView("member_directory", {	memberId: uuid("member_id"),
	profileId: uuid("profile_id"),
	branchId: uuid("branch_id"),
	groupId: uuid("group_id"),
	isActive: boolean("is_active"),
	enrollmentStatus: enrollmentStatus("enrollment_status"),
	hasFace: boolean("has_face"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	bypassFace: boolean("bypass_face"),
	bypassLocation: boolean("bypass_location"),
	frozenAt: timestamp("frozen_at", { withTimezone: true, mode: 'string' }),
	canGenerateQr: boolean("can_generate_qr"),
	fullName: text("full_name"),
	nationalId: text("national_id"),
	phone: text(),
	groupName: text("group_name"),
	groupYear: integer("group_year"),
	institutionCode: integer("institution_code"),
	institutionName: text("institution_name"),
	branchName: text("branch_name"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	serial: bigint({ mode: "number" }),
	memberCode: text("member_code"),
	email: text(),
	avatarUrl: text("avatar_url"),
	canMakeRoster: boolean("can_make_roster"),
	bypassCheckoutWindow: boolean("bypass_checkout_window"),
	canResetFace: boolean("can_reset_face"),
// security_invoker keeps the view evaluating as whoever queries it rather than
// as its owner. Nothing depends on that today — the API connects as one role and
// authorization happens above the database — but a view that silently runs with
// its owner's rights is the kind of thing that becomes a privilege escalation
// the moment someone grants it to anybody else. Note that a bare
// CREATE OR REPLACE VIEW resets reloptions, so this must be restated whenever
// the definition changes.
}).with({ securityInvoker: true }).as(sql`WITH base AS ( SELECT i.id AS member_id, i.profile_id, i.branch_id, i.group_id, i.is_active, i.enrollment_status, (EXISTS ( SELECT 1 FROM face_templates ft WHERE ft.member_id = i.id)) AS has_face, i.created_at, i.bypass_face, i.bypass_location, i.bypass_checkout_window, i.frozen_at, i.can_generate_qr, p.full_name, p.national_id, p.phone, p.email, p.avatar_url, b.name AS group_name, b.year AS group_year, COALESCE(inst.code, b.institution_code, 0) AS institution_code, COALESCE(inst.name, b.institution_name) AS institution_name, h.name AS branch_name, i.can_make_roster, i.can_reset_face, NULLIF(SUBSTRING(i.member_code FROM 7), ''::text)::bigint AS serial, i.member_code AS stored_member_code FROM members i JOIN profiles p ON p.id = i.profile_id LEFT JOIN groups b ON b.id = i.group_id LEFT JOIN institutions inst ON inst.id = b.institution_id LEFT JOIN branches h ON h.id = i.branch_id ) SELECT member_id, profile_id, branch_id, group_id, is_active, enrollment_status, has_face, created_at, bypass_face, bypass_location, frozen_at, can_generate_qr, full_name, national_id, phone, group_name, group_year, institution_code, institution_name, branch_name, serial, stored_member_code AS member_code, email, avatar_url, can_make_roster, bypass_checkout_window, can_reset_face FROM base`);