-- Which liveness proof the check-in camera asks for:
--   action — a random expression challenge (blink / smile / open mouth / brows).
--            Stops a printed photo, but a replayed video performs them all.
--   turn   — turn the head; the camera measures the parallax only a real 3D
--            face can produce, so a flat print OR a phone screen both fail.
--   both   — the turn first, then an expression.
-- Applies to the in-app (web) camera; the native OS camera has no live feed to
-- run a challenge on.
alter table public.app_settings
  add column if not exists liveness_mode text not null default 'turn';
alter table public.app_settings drop constraint if exists app_settings_liveness_mode_check;
alter table public.app_settings
  add constraint app_settings_liveness_mode_check
  check (liveness_mode in ('action', 'turn', 'both'));
