-- WHSF Forum: moderators must also pass "Confirm it's you" before using moderator powers on the Forum.
-- forum_is_staff() = WHSF staff role AND a trusted sign-in session (see 20261014_forum_login_security.sql).
-- Every Forum policy and Forum function that used whsf_is_staff() now uses forum_is_staff().
-- Other WHSF apps (grants, e-classroom, staff directory) keep using whsf_is_staff() unchanged.

create or replace function public.forum_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.whsf_is_staff() and public.forum_session_trusted();
$$;
revoke all on function public.forum_is_staff() from public, anon;
grant execute on function public.forum_is_staff() to authenticated;

do $$
declare r record; v_def text; v_sql text;
begin
  -- Forum functions
  for r in
    select p.oid from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.proname like 'forum%' and p.proname <> 'forum_is_staff' and p.prosrc like '%whsf_is_staff%'
  loop
    v_def := replace(pg_get_functiondef(r.oid), 'whsf_is_staff()', 'forum_is_staff()');
    execute v_def;
  end loop;
  -- Forum table policies and Forum storage-bucket policies
  for r in
    select schemaname, tablename, policyname, cmd, qual, with_check from pg_policies
    where (qual like '%whsf_is_staff()%' or with_check like '%whsf_is_staff()%')
      and ((schemaname = 'public' and tablename like 'forum%')
        or (schemaname = 'storage' and tablename = 'objects' and (coalesce(qual, '') || coalesce(with_check, '')) like '%forum-%'))
  loop
    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if r.qual is not null then v_sql := v_sql || ' using (' || replace(r.qual, 'whsf_is_staff()', 'forum_is_staff()') || ')'; end if;
    if r.with_check is not null then v_sql := v_sql || ' with check (' || replace(r.with_check, 'whsf_is_staff()', 'forum_is_staff()') || ')'; end if;
    execute v_sql;
  end loop;
end $$;

-- Linter: fixed search_path on two helper functions.
alter function public.forum_text_items_ok(text[], integer) set search_path = public;
alter function public.forum_json_items_ok(jsonb, text[], integer) set search_path = public;
