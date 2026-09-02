-- Device-integrity gate: default OFF so it can't silently lock everyone out, and
-- clear it on the live row (it was rejecting check-ins because the app sends no
-- integrity token yet). With the native app now sending a marker, turning this
-- back on gates check-in to the installed app (a browser is rejected).
alter table public.app_settings alter column require_play_integrity set default false;
update public.app_settings set require_play_integrity = false where id = 1;
