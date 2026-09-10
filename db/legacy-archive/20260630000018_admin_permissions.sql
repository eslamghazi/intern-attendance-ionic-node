-- Per-admin privileges (pages + operations). null => full base access (kept for
-- backward compatibility so existing admins aren't locked out).
alter table public.profiles
  add column if not exists permissions jsonb;
