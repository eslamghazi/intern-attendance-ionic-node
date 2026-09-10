-- Whether members may decode a location QR out of an IMAGE they pick from their
-- gallery, instead of pointing the camera at it. Convenient when the live camera
-- can't get a clean read (glare, a code shown on a screen) — but it also means a
-- screenshot of the code can be forwarded to someone who is not on site, so it
-- is an admin decision. The token's own validity window still applies.
alter table public.app_settings
  add column if not exists qr_allow_image boolean not null default true;
