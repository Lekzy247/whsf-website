-- 2026-11-24 (owner): moderators can remove an applicant/member completely from the Forum admin; post attachments
-- are PDF only (no video uploads) to save WHSF storage. ID-check videos are unchanged.

-- ID fingerprints outlive a removed account, so a removed person can be blocked from rejoining with the same ID.
alter table public.forum_id_documents drop constraint if exists forum_id_documents_check_id_fkey;
alter table public.forum_id_documents drop constraint if exists forum_id_documents_outcome_check;
alter table public.forum_id_documents add constraint forum_id_documents_outcome_check
  check (outcome in ('approved', 'underage', 'rejected', 'banned'));

create or replace function public.forum_admin_remove_member(p_user uuid, p_reason text, p_block_id boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare v_profile jsonb; v_email text; v_role text;
begin
  if not public.forum_is_staff() then raise exception 'Moderators only.' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'You cannot remove your own account.'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Give a short reason for removing this person.'; end if;
  select u.email, u.raw_app_meta_data ->> 'role' into v_email, v_role from auth.users u where u.id = p_user;
  if v_email is null and not exists (select 1 from forum_profiles where user_id = p_user) then raise exception 'Member not found.'; end if;
  if v_role in ('admin', 'teacher') then raise exception 'Moderator accounts cannot be removed here.'; end if;
  if exists (select 1 from whsf_grant_orgs where owner_id = p_user) then
    raise exception 'This person also owns a grants portal organisation. Remove it in Grants admin first.';
  end if;
  select to_jsonb(p) into v_profile from forum_profiles p where p.user_id = p_user;
  -- Archive first (restorable record of who was removed and why); ID files themselves are not kept.
  insert into whsf_removed_records (source_table, record, reason)
  values ('forum_profiles', coalesce(v_profile, '{}'::jsonb) || jsonb_build_object(
      'email', v_email, 'removed_by', auth.uid(), 'blocked_id', coalesce(p_block_id, false),
      'id_checks', (select coalesce(jsonb_agg(jsonb_build_object('status', c.status, 'method', c.method, 'country', c.country,
          'id_type', c.id_type, 'legal_name', c.legal_name, 'submitted_at', c.submitted_at, 'reject_reason', c.reject_reason)), '[]'::jsonb)
        from forum_id_checks c where c.user_id = p_user)),
    left(btrim(p_reason), 300));
  if coalesce(p_block_id, false) then
    update forum_id_documents set outcome = 'banned' where user_id = p_user;
  else
    delete from forum_id_documents where user_id = p_user;
  end if;
  insert into forum_audit_log (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), 'member_removed', 'member', p_user::text,
          jsonb_build_object('reason', left(btrim(p_reason), 300), 'blocked_id', coalesce(p_block_id, false)));
  delete from forum_profiles where user_id = p_user;
  delete from auth.users where id = p_user;
  return 'removed';
end $$;
revoke execute on function public.forum_admin_remove_member(uuid, text, boolean) from public, anon;
grant execute on function public.forum_admin_remove_member(uuid, text, boolean) to authenticated;

-- Review: a blocked (removed) person's ID is rejected automatically, with what to do.
create or replace function public.forum_id_banned_reason(p_hash text, p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from forum_id_documents d where d.doc_hash = p_hash and d.user_id <> p_user and d.outcome = 'banned')
      then 'This ID belongs to a person who was removed from the WHSF Forum. What to do: contact WHSF through the Contact page if you think this is a mistake'
    when exists (select 1 from forum_id_documents d where d.doc_hash = p_hash and d.user_id <> p_user and d.outcome in ('approved', 'underage'))
      then 'This ID is already linked to another Forum account, and each person may have only one account. What to do: sign in to your existing account, or contact WHSF'
  end;
$$;
revoke execute on function public.forum_id_banned_reason(text, uuid) from public, anon, authenticated;

do $$ declare d text;
begin
  d := pg_get_functiondef('public.forum_id_review_v2(uuid, boolean, text, date, date, boolean, text, jsonb)'::regprocedure);
  d := replace(d,
    $x$elsif v_hash is not null and exists (select 1 from forum_id_documents d where d.doc_hash = v_hash and d.user_id <> c.user_id and d.outcome in ('approved', 'underage')) then
    v_auto := 'This ID is already linked to another Forum account, and each person may have only one account. What to do: sign in to your existing account, or contact WHSF';$x$,
    $x$elsif v_hash is not null and public.forum_id_banned_reason(v_hash, c.user_id) is not null then
    v_auto := public.forum_id_banned_reason(v_hash, c.user_id);$x$);
  if position('forum_id_banned_reason' in d) = 0 then raise exception 'review_v2 patch did not apply'; end if;
  execute d;
end $$;

-- Post attachments: PDF only, 10 MB (videos used the most storage).
update storage.buckets set allowed_mime_types = array['application/pdf'], file_size_limit = 10485760 where id = 'forum-files';
