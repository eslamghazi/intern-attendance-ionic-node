-- ============================================================================
-- Intern Attendance — core schema
-- Faculty of Nursing, Kafr El Sheikh University
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid, crypt
create extension if not exists "postgis";     -- geofencing (ST_DWithin)
create extension if not exists "vector";      -- face embeddings (pgvector)

-- Enums ---------------------------------------------------------------------
do $$ begin
  create type public.role as enum ('superadmin', 'admin', 'intern');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.enrollment_status as enum ('pending', 'enrolled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('present', 'late', 'early_leave', 'absent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.audit_event as enum (
    'login','password_changed','face_enrolled','mock_location_detected',
    'out_of_range','low_accuracy','face_mismatch','liveness_failed',
    'integrity_failed','check_in','check_out'
  );
exception when duplicate_object then null; end $$;

-- Profiles (1:1 with auth.users) --------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  role                 public.role not null default 'intern',
  full_name            text not null,
  national_id          text not null unique,
  phone                text,
  must_change_password boolean not null default true,
  is_active            boolean not null default true,
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now()
);

-- Batches (دفعات) -----------------------------------------------------------
create table if not exists public.batches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  year       int  not null,
  start_date date,
  end_date   date,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Hospitals (مستشفيات) with geofence ----------------------------------------
create table if not exists public.hospitals (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  address       text,
  latitude      double precision not null,
  longitude     double precision not null,
  radius_meters integer not null default 150 check (radius_meters between 20 and 5000),
  geom          geography(Point, 4326),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Keep geom in sync with latitude/longitude via trigger (robust vs generated col)
create or replace function public.hospitals_set_geom()
returns trigger language plpgsql as $$
begin
  new.geom := ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326)::geography;
  return new;
end $$;

drop trigger if exists trg_hospitals_set_geom on public.hospitals;
create trigger trg_hospitals_set_geom
  before insert or update of latitude, longitude on public.hospitals
  for each row execute function public.hospitals_set_geom();

create index if not exists hospitals_geom_idx on public.hospitals using gist (geom);

-- Interns -------------------------------------------------------------------
create table if not exists public.interns (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null unique references public.profiles(id) on delete cascade,
  batch_id          uuid not null references public.batches(id),
  hospital_id       uuid not null references public.hospitals(id),
  enrollment_status public.enrollment_status not null default 'pending',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists interns_batch_idx on public.interns(batch_id);
create index if not exists interns_hospital_idx on public.interns(hospital_id);

-- Face templates (one reference embedding per intern) -----------------------
create table if not exists public.face_templates (
  id            uuid primary key default gen_random_uuid(),
  intern_id     uuid not null unique references public.interns(id) on delete cascade,
  embedding     vector(512) not null,   -- model output dim MUST equal 512
  photo_path    text,
  quality_score real,
  created_at    timestamptz not null default now()
);

-- Attendance (one row per intern per day) -----------------------------------
create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  intern_id   uuid not null references public.interns(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id),
  date        date not null,
  status      public.attendance_status not null default 'present',

  check_in_at              timestamptz,
  check_in_lat             double precision,
  check_in_lng             double precision,
  check_in_accuracy_m      real,
  check_in_distance_m      real,
  check_in_face_score      real,
  check_in_liveness_passed boolean,
  check_in_is_mock         boolean,
  check_in_probe_path      text,

  check_out_at              timestamptz,
  check_out_lat             double precision,
  check_out_lng             double precision,
  check_out_accuracy_m      real,
  check_out_distance_m      real,
  check_out_face_score      real,
  check_out_liveness_passed boolean,
  check_out_is_mock         boolean,
  check_out_probe_path      text,

  created_at  timestamptz not null default now(),
  unique (intern_id, date)
);
create index if not exists attendance_date_idx on public.attendance(date);
create index if not exists attendance_hospital_date_idx on public.attendance(hospital_id, date);

-- Admin scoping: which batches / hospitals an admin manages ------------------
create table if not exists public.admin_assignments (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.profiles(id) on delete cascade,
  batch_id    uuid references public.batches(id) on delete cascade,
  hospital_id uuid references public.hospitals(id) on delete cascade,
  check (batch_id is not null or hospital_id is not null)
);
create index if not exists admin_assignments_admin_idx on public.admin_assignments(admin_id);

-- App settings (singleton row id = 1) ---------------------------------------
create table if not exists public.app_settings (
  id                     int primary key default 1 check (id = 1),
  face_match_threshold   real not null default 0.65,
  liveness_required      boolean not null default true,
  default_radius_meters  int not null default 150,
  max_accuracy_meters    int not null default 50,
  shift_start            time not null default '07:00',
  shift_end              time not null default '17:00',
  late_grace_minutes     int not null default 30,
  require_play_integrity boolean not null default false
);

-- Audit log -----------------------------------------------------------------
create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles(id) on delete set null,
  event      public.audit_event not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
