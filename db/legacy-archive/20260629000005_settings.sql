-- ============================================================================
-- Seed the singleton app_settings row with sensible defaults.
-- The superadmin account is created via scripts/seed-superadmin.mjs (Admin API),
-- which is more robust than hand-inserting into auth.users.
-- ============================================================================

insert into public.app_settings (id) values (1)
on conflict (id) do nothing;
