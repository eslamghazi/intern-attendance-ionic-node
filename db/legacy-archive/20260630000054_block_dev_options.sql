-- Admin toggle: reject a check-in when Android Developer Options is enabled
-- (the switch that lets mock-location apps override GPS). Defaults ON.
alter table public.app_settings
  add column if not exists block_dev_options boolean not null default true;
