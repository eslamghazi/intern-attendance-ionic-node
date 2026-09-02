-- Web-only anti-spoof: sample several GPS fixes and reject a browser check-in
-- when the position is "frozen" (no jitter) — a sign of a mock app feeding a
-- constant point. Opt-in (default OFF) because it adds a few seconds to the
-- check-in and can false-positive on smoothed/fused stationary fixes.
alter table public.app_settings
  add column if not exists web_detect_frozen_gps boolean not null default false;
