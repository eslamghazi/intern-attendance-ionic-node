-- Clear the DB pointers to images an admin deleted from storage.
--
-- Deleting the file alone leaves `face_templates.photo_path` and the attendance
-- `*_probe_path` columns pointing at something that no longer exists. Those
-- columns must be cleared too — but neither table may be written from the
-- client: attendance is written only by record-attendance (service role), and
-- face_templates may only be updated by the member who owns it. So instead of
-- weakening either policy, this SECURITY DEFINER function does exactly one
-- narrow job, and checks the caller is an admin itself.
--
-- IMPORTANT: it touches the path columns ONLY. The face EMBEDDING is never
-- read, changed or deleted here — removing a stored photo must not un-enroll
-- anybody. Resetting a face print is a different action (reset-face).
create or replace function public.clear_image_paths(p_paths text[])
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cleared integer := 0;
  n integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_paths is null or array_length(p_paths, 1) is null then
    return 0;
  end if;

  update public.face_templates set photo_path = null where photo_path = any(p_paths);
  get diagnostics n = row_count;
  cleared := cleared + n;

  update public.attendance set check_in_probe_path = null where check_in_probe_path = any(p_paths);
  get diagnostics n = row_count;
  cleared := cleared + n;

  update public.attendance set check_out_probe_path = null where check_out_probe_path = any(p_paths);
  get diagnostics n = row_count;
  cleared := cleared + n;

  return cleared;
end $function$;

revoke all on function public.clear_image_paths(text[]) from public;
grant execute on function public.clear_image_paths(text[]) to authenticated;
