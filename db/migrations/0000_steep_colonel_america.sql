CREATE SCHEMA IF NOT EXISTS "auth";
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "storage";
--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'late', 'early_leave', 'absent', 'left_work');--> statement-breakpoint
CREATE TYPE "public"."audit_event" AS ENUM('login', 'password_changed', 'face_enrolled', 'mock_location_detected', 'out_of_range', 'low_accuracy', 'face_mismatch', 'liveness_failed', 'integrity_failed', 'check_in', 'check_out');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('pending', 'enrolled');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('superadmin', 'admin', 'member');--> statement-breakpoint
CREATE TABLE "admin_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"group_id" uuid,
	"branch_id" uuid,
	CONSTRAINT "admin_assignments_check" CHECK ((group_id IS NOT NULL) OR (branch_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"face_match_threshold" real DEFAULT 0.65 NOT NULL,
	"liveness_required" boolean DEFAULT true NOT NULL,
	"default_radius_meters" integer DEFAULT 150 NOT NULL,
	"max_accuracy_meters" integer DEFAULT 50 NOT NULL,
	"shift_start" time DEFAULT '07:00:00' NOT NULL,
	"shift_end" time DEFAULT '17:00:00' NOT NULL,
	"late_grace_minutes" integer DEFAULT 30 NOT NULL,
	"require_play_integrity" boolean DEFAULT false NOT NULL,
	"bypass_face" boolean DEFAULT false NOT NULL,
	"bypass_location" boolean DEFAULT false NOT NULL,
	"store_face_images" boolean DEFAULT false NOT NULL,
	"qr_requires_member" boolean DEFAULT false NOT NULL,
	"qr_validity_seconds" integer DEFAULT 25 NOT NULL,
	"qr_bypass_minutes" integer DEFAULT 30 NOT NULL,
	"enforce_shift_window" boolean DEFAULT false NOT NULL,
	"allow_checkout_only" boolean DEFAULT false NOT NULL,
	"auto_leave_work" boolean DEFAULT false NOT NULL,
	"org_name" text,
	"org_logo_url" text,
	"terminology" text DEFAULT 'generic' NOT NULL,
	"master_password_hash" text,
	"member_photos" boolean DEFAULT true NOT NULL,
	"show_out_of_range_map" boolean DEFAULT true NOT NULL,
	"block_dev_options" boolean DEFAULT true NOT NULL,
	"location_ip_max_km" integer DEFAULT 100 NOT NULL,
	"web_detect_frozen_gps" boolean DEFAULT false NOT NULL,
	"checkin_method" text DEFAULT 'both' NOT NULL,
	"bypass_checkout_window" boolean DEFAULT false NOT NULL,
	"liveness_mode" text DEFAULT 'turn' NOT NULL,
	"qr_allow_image" boolean DEFAULT true NOT NULL,
	CONSTRAINT "app_settings_id_check" CHECK (id = 1),
	CONSTRAINT "app_settings_checkin_method_check" CHECK (checkin_method = ANY (ARRAY['location'::text, 'qr'::text, 'both'::text, 'none'::text])),
	CONSTRAINT "app_settings_liveness_mode_check" CHECK (liveness_mode = ANY (ARRAY['action'::text, 'turn'::text, 'both'::text]))
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "attendance_status" DEFAULT 'present' NOT NULL,
	"check_in_at" timestamp with time zone,
	"check_in_lat" double precision,
	"check_in_lng" double precision,
	"check_in_accuracy_m" real,
	"check_in_distance_m" real,
	"check_in_face_score" real,
	"check_in_liveness_passed" boolean,
	"check_in_is_mock" boolean,
	"check_in_probe_path" text,
	"check_out_at" timestamp with time zone,
	"check_out_lat" double precision,
	"check_out_lng" double precision,
	"check_out_accuracy_m" real,
	"check_out_distance_m" real,
	"check_out_face_score" real,
	"check_out_liveness_passed" boolean,
	"check_out_is_mock" boolean,
	"check_out_probe_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shift_id" uuid,
	"shift_name" text,
	"check_in_bypass" jsonb,
	"check_out_bypass" jsonb,
	"checkout_status" text
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"event" "audit_event" NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"radius_meters" integer DEFAULT 150 NOT NULL,
	"geom" geography(Point,4326),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bypass_face" boolean DEFAULT false NOT NULL,
	"bypass_location" boolean DEFAULT false NOT NULL,
	"institution_id" uuid,
	"area_coords" jsonb,
	"area" geography(Point,4326),
	"qr_enabled" boolean DEFAULT true NOT NULL,
	"block_checkin" boolean DEFAULT false NOT NULL,
	"require_qr" boolean DEFAULT false NOT NULL,
	"bypass_checkout_window" boolean DEFAULT false NOT NULL,
	CONSTRAINT "hospitals_radius_meters_check" CHECK ((radius_meters >= 20) AND (radius_meters <= 5000))
);
--> statement-breakpoint
CREATE TABLE "storage"."buckets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner" uuid,
	"public" boolean DEFAULT false NOT NULL,
	"file_size_limit" bigint,
	"allowed_mime_types" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buckets_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"branch_id" uuid
);
--> statement-breakpoint
CREATE TABLE "face_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"embedding" vector(512) NOT NULL,
	"photo_path" text,
	"quality_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "face_templates_intern_id_key" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"start_date" date,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bypass_face" boolean DEFAULT false NOT NULL,
	"bypass_location" boolean DEFAULT false NOT NULL,
	"institution_code" integer DEFAULT 1 NOT NULL,
	"institution_name" text,
	"institution_id" uuid,
	"branch_id" uuid,
	"bypass_checkout_window" boolean DEFAULT false NOT NULL,
	CONSTRAINT "groups_year_width_check" CHECK ((year >= 1000) AND (year <= 9999))
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institutions_code_width_check" CHECK ((code >= 0) AND (code <= 99))
);
--> statement-breakpoint
CREATE TABLE "member_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"department_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "member_departments_intern_id_year_month_key" UNIQUE("member_id","year","month")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"enrollment_status" "enrollment_status" DEFAULT 'pending' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bypass_face" boolean DEFAULT false NOT NULL,
	"bypass_location" boolean DEFAULT false NOT NULL,
	"frozen_at" timestamp with time zone,
	"can_generate_qr" boolean DEFAULT false NOT NULL,
	"location_bypass_until" timestamp with time zone,
	"can_make_roster" boolean DEFAULT false NOT NULL,
	"bypass_checkout_window" boolean DEFAULT false NOT NULL,
	"can_reset_face" boolean DEFAULT false NOT NULL,
	"member_code" text,
	CONSTRAINT "interns_profile_id_key" UNIQUE("profile_id")
);
--> statement-breakpoint
CREATE TABLE "storage"."objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket_id" text NOT NULL,
	"name" text NOT NULL,
	"owner" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"path_tokens" text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "objects_bucket_id_name_key" UNIQUE("bucket_id","name")
);
--> statement-breakpoint
CREATE TABLE "presence_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid,
	"group_id" uuid,
	"department_id" uuid,
	"shift_id" uuid,
	"date" date NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"target_member_ids" uuid[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"decision" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "presence_checks_status_check" CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text, 'cancelled'::text])),
	CONSTRAINT "presence_checks_decision_check" CHECK (decision = ANY (ARRAY['left_work'::text, 'keep'::text]))
);
--> statement-breakpoint
CREATE TABLE "presence_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presence_confirmations_check_id_member_id_key" UNIQUE("check_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "role" DEFAULT 'member' NOT NULL,
	"full_name" text NOT NULL,
	"national_id" text NOT NULL,
	"phone" text,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"permissions" jsonb,
	"email" text,
	"password_hash" text,
	"avatar_url" text,
	CONSTRAINT "profiles_national_id_key" UNIQUE("national_id")
);
--> statement-breakpoint
CREATE TABLE "qr_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"branch_id" uuid NOT NULL,
	"date" date NOT NULL,
	"member_id" uuid,
	"single_use" boolean DEFAULT false NOT NULL,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qr_tokens_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "roster_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"date" date NOT NULL,
	"shift_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key" text,
	"late_grace_minutes" integer DEFAULT 15 NOT NULL,
	"late_from" time,
	"late_to" time,
	"checkin_open" time,
	"checkin_late" time,
	"checkin_close" time,
	"checkout_open" time,
	"checkout_close" time
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"encrypted_password" text,
	"email_confirmed_at" timestamp with time zone,
	"last_sign_in_at" timestamp with time zone,
	"raw_user_meta_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"banned_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "admin_assignments" ADD CONSTRAINT "admin_assignments_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_assignments" ADD CONSTRAINT "admin_assignments_batch_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_assignments" ADD CONSTRAINT "admin_assignments_hospital_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_intern_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_hospital_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "hospitals_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_hospital_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "face_templates" ADD CONSTRAINT "face_templates_intern_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "batches_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "batches_hospital_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_departments" ADD CONSTRAINT "member_departments_intern_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_departments" ADD CONSTRAINT "member_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "interns_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "interns_batch_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "interns_hospital_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage"."objects" ADD CONSTRAINT "objects_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_checks" ADD CONSTRAINT "presence_checks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_checks" ADD CONSTRAINT "presence_checks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_checks" ADD CONSTRAINT "presence_checks_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_checks" ADD CONSTRAINT "presence_checks_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_checks" ADD CONSTRAINT "presence_checks_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_confirmations" ADD CONSTRAINT "presence_confirmations_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "public"."presence_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_confirmations" ADD CONSTRAINT "presence_confirmations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_hospital_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_intern_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_days" ADD CONSTRAINT "roster_days_intern_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_days" ADD CONSTRAINT "roster_days_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_assignments_admin_idx" ON "admin_assignments" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance" USING btree ("date");--> statement-breakpoint
CREATE INDEX "attendance_hospital_date_idx" ON "attendance" USING btree ("branch_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_intern_date_shift_key" ON "attendance" USING btree ("member_id","date","shift_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "hospitals_geom_idx" ON "branches" USING gist ("geom" gist_geography_ops);--> statement-breakpoint
CREATE INDEX "member_departments_month_idx" ON "member_departments" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "interns_batch_idx" ON "members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "interns_hospital_idx" ON "members" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_member_code_key" ON "members" USING btree ("member_code") WHERE (member_code IS NOT NULL);--> statement-breakpoint
CREATE INDEX "objects_bucket_name_idx" ON "storage"."objects" USING btree ("bucket_id","name");--> statement-breakpoint
CREATE INDEX "presence_checks_creator_idx" ON "presence_checks" USING btree ("created_by","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "presence_checks_open_idx" ON "presence_checks" USING btree ("status","deadline");--> statement-breakpoint
CREATE INDEX "qr_tokens_expires_at_idx" ON "qr_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "qr_tokens_token_idx" ON "qr_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "roster_days_intern_date_idx" ON "roster_days" USING btree ("member_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "roster_days_intern_date_shift_key" ON "roster_days" USING btree ("member_id","date","shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_key_unique" ON "shifts" USING btree (lower(key)) WHERE (key IS NOT NULL);--> statement-breakpoint
CREATE VIEW "public"."member_directory" AS (WITH base AS ( SELECT i.id AS member_id, i.profile_id, i.branch_id, i.group_id, i.is_active, i.enrollment_status, (EXISTS ( SELECT 1 FROM face_templates ft WHERE ft.member_id = i.id)) AS has_face, i.created_at, i.bypass_face, i.bypass_location, i.bypass_checkout_window, i.frozen_at, i.can_generate_qr, p.full_name, p.national_id, p.phone, p.email, p.avatar_url, b.name AS group_name, b.year AS group_year, COALESCE(inst.code, b.institution_code, 0) AS institution_code, COALESCE(inst.name, b.institution_name) AS institution_name, h.name AS branch_name, i.can_make_roster, i.can_reset_face, NULLIF(SUBSTRING(i.member_code FROM 7), ''::text)::bigint AS serial, i.member_code AS stored_member_code FROM members i JOIN profiles p ON p.id = i.profile_id LEFT JOIN groups b ON b.id = i.group_id LEFT JOIN institutions inst ON inst.id = b.institution_id LEFT JOIN branches h ON h.id = i.branch_id ) SELECT member_id, profile_id, branch_id, group_id, is_active, enrollment_status, has_face, created_at, bypass_face, bypass_location, frozen_at, can_generate_qr, full_name, national_id, phone, group_name, group_year, institution_code, institution_name, branch_name, serial, stored_member_code AS member_code, email, avatar_url, can_make_roster, bypass_checkout_window, can_reset_face FROM base);