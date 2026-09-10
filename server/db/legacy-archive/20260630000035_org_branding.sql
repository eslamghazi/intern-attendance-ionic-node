-- Organization branding: a customer-configurable name + logo so the app isn't
-- hard-wired to one institution. Both live on the single app_settings row and
-- show in the app and on every exported document. The logo is stored inline as
-- a data URL (small SVG/PNG), so no extra storage bucket is required.
alter table public.app_settings
  add column if not exists org_name text,
  add column if not exists org_logo_url text;
