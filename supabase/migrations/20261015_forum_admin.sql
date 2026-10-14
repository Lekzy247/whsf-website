-- WHSF Forum moderator centre: audit log of moderator actions, member management, reports queue and statistics.
-- All admin functions require forum_is_staff() (WHSF staff role + a confirmed sign-in session).

-- Suspension details
alter table public.forum_profiles add column if not exists suspended_at timestamptz;
alter table public.forum_profiles add column if not exists suspended_reason text check (suspended_reason is null or char_length(suspended_reason) <= 300);

create or replace function public.forum_profiles_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.forum_is_staff() then
    new.is_suspended := old.is_suspended;
    new.suspended_at := old.suspended_at;
    new.suspended_reason := old.suspended_reason;
    new.adult_confirmed_at := old.adult_confirmed_at;
    new.rules_accepted_at := old.rules_accepted_at;
    new.user_id := old.user_id;
    if coalesce(current_setting('whsf.forum_id_rpc', true), '') <> 'on' then
      new.verification_status := old.verification_status;
      new.verified_at := old.verified_at;
      new.verification_reason := old.verification_reason;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Audit log (written only by the trigger below; readable only by WHSF moderators; never edited).
create table if not exists public.forum_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists forum_audit_log_created_idx on public.forum_audit_log (created_at desc);
alter table public.forum_audit_log enable row level security;
revoke all on public.forum_audit_log from anon, authenticated;
grant select on public.forum_audit_log to authenticated;
drop policy if exists "Audit log: moderators read" on public.forum_audit_log;
create policy "Audit log: moderators read" on public.forum_audit_log for select to authenticated using (public.forum_is_staff());

create or replace function public.forum_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  n jsonb := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) else '{}'::jsonb end;
  actor uuid := auth.uid();
  act text; ttype text; tid text; det jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'forum_posts' then
    ttype := 'post'; tid := coalesce(n ->> 'id', o ->> 'id');
    det := jsonb_build_object('author_id', coalesce(n ->> 'author_id', o ->> 'author_id'), 'excerpt', left(coalesce(n ->> 'body', o ->> 'body'), 140));
    if tg_op = 'DELETE' and actor is not null and actor::text <> o ->> 'author_id' then act := 'post.delete';
    elsif tg_op = 'UPDATE' and (o ->> 'is_hidden') is distinct from (n ->> 'is_hidden') then
      act := case when (n ->> 'is_hidden')::boolean then 'post.hide' else 'post.unhide' end; det := det || jsonb_build_object('reason', n ->> 'hidden_reason');
    elsif tg_op = 'UPDATE' and (o ->> 'is_pinned') is distinct from (n ->> 'is_pinned') then
      act := case when (n ->> 'is_pinned')::boolean then 'post.pin' else 'post.unpin' end;
    elsif tg_op = 'UPDATE' and (o ->> 'featured_at') is distinct from (n ->> 'featured_at') then
      act := case when n ->> 'featured_at' is not null then 'post.feature' else 'post.unfeature' end;
    end if;
  elsif tg_table_name = 'forum_profiles' then
    ttype := 'member'; tid := coalesce(n ->> 'user_id', o ->> 'user_id'); det := jsonb_build_object('name', coalesce(n ->> 'display_name', o ->> 'display_name'));
    if tg_op = 'UPDATE' and (o ->> 'is_suspended') is distinct from (n ->> 'is_suspended') then
      act := case when (n ->> 'is_suspended')::boolean then 'member.suspend' else 'member.restore' end; det := det || jsonb_build_object('reason', n ->> 'suspended_reason');
    elsif tg_op = 'UPDATE' and (o ->> 'verification_status') is distinct from (n ->> 'verification_status') and actor::text is distinct from tid then
      act := 'member.verification_' || (n ->> 'verification_status'); det := det || jsonb_build_object('reason', n ->> 'verification_reason');
    end if;
  elsif tg_table_name = 'forum_reports' then
    ttype := 'report'; tid := coalesce(n ->> 'id', o ->> 'id'); det := jsonb_build_object('post_id', coalesce(n ->> 'post_id', o ->> 'post_id'));
    if tg_op = 'UPDATE' and (o ->> 'resolved') is distinct from (n ->> 'resolved') then
      act := case when (n ->> 'resolved')::boolean then 'report.resolve' else 'report.reopen' end;
    end if;
  elsif tg_table_name in ('forum_events', 'forum_ads', 'forum_id_checks', 'whsf_programme_registrations') then
    ttype := case tg_table_name when 'forum_events' then 'event' when 'forum_ads' then 'advert' when 'forum_id_checks' then 'id_check' else 'registration' end;
    tid := coalesce(n ->> 'id', o ->> 'id');
    det := jsonb_build_object('title', coalesce(n ->> 'title', n ->> 'headline', n ->> 'reference', o ->> 'title'), 'note', coalesce(n ->> 'review_note', n ->> 'reject_reason'));
    if tg_op = 'UPDATE' and (o ->> 'status') is distinct from (n ->> 'status')
       and actor::text is distinct from coalesce(n ->> 'host_id', n ->> 'owner_id', n ->> 'user_id', '') then
      act := ttype || '.' || (n ->> 'status');
    end if;
  elsif tg_table_name = 'forum_space_moderators' then
    ttype := 'space'; tid := coalesce(n ->> 'space', o ->> 'space'); det := jsonb_build_object('user_id', coalesce(n ->> 'user_id', o ->> 'user_id'));
    act := case tg_op when 'INSERT' then 'space.moderator_add' when 'DELETE' then 'space.moderator_remove' end;
  elsif tg_table_name = 'forum_space_resources' then
    ttype := 'space'; tid := coalesce(n ->> 'space', o ->> 'space'); det := jsonb_build_object('title', coalesce(n ->> 'title', o ->> 'title'), 'url', coalesce(n ->> 'url', o ->> 'url'));
    act := case tg_op when 'INSERT' then 'space.resource_add' when 'DELETE' then 'space.resource_remove' end;
  end if;
  if act is not null then
    insert into forum_audit_log (actor_id, action, target_type, target_id, detail) values (actor, act, ttype, tid, det);
  end if;
  return null;
end;
$$;
revoke all on function public.forum_audit_trigger() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['forum_posts', 'forum_profiles', 'forum_reports', 'forum_events', 'forum_ads', 'forum_id_checks',
    'forum_space_moderators', 'forum_space_resources', 'whsf_programme_registrations'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.forum_audit_trigger()', t || '_audit', t);
  end loop;
end $$;

-- Statistics for the overview
create or replace function public.forum_admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.forum_is_staff() then raise exception 'Moderators only.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'members_total', (select count(*) from forum_profiles),
    'members_approved', (select count(*) from forum_profiles where verification_status = 'approved' and not is_suspended),
    'members_pending', (select count(*) from forum_profiles where verification_status = 'pending'),
    'members_suspended', (select count(*) from forum_profiles where is_suspended),
    'members_new_7d', (select count(*) from forum_profiles where created_at > now() - interval '7 days'),
    'members_new_30d', (select count(*) from forum_profiles where created_at > now() - interval '30 days'),
    'active_7d', (select count(distinct u) from (
        select author_id u from forum_posts where created_at > now() - interval '7 days'
        union select author_id from forum_comments where created_at > now() - interval '7 days'
        union select user_id from forum_reactions where created_at > now() - interval '7 days') x),
    'posts_7d', (select count(*) from forum_posts where created_at > now() - interval '7 days'),
    'posts_30d', (select count(*) from forum_posts where created_at > now() - interval '30 days'),
    'comments_7d', (select count(*) from forum_comments where created_at > now() - interval '7 days'),
    'reactions_7d', (select count(*) from forum_reactions where created_at > now() - interval '7 days'),
    'reports_open', (select count(*) from forum_reports where not resolved),
    'id_checks_pending', (select count(*) from forum_id_checks where status = 'pending'),
    'events_pending', (select count(*) from forum_events where status = 'pending'),
    'events_upcoming', (select count(*) from forum_events where status = 'published' and ends_at > now()),
    'ads_pending', (select count(*) from forum_ads where status = 'pending'),
    'registrations_new', (select count(*) from whsf_programme_registrations where status = 'new'),
    'registrations_by_programme', (select coalesce(jsonb_object_agg(programme, c), '{}'::jsonb) from (select programme, count(*) c from whsf_programme_registrations group by 1) x),
    'posts_by_space_30d', (select coalesce(jsonb_object_agg(topic, c), '{}'::jsonb) from (select topic, count(*) c from forum_posts where created_at > now() - interval '30 days' group by 1) x),
    'posts_daily_14d', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'posts', (select count(*) from forum_posts p where p.created_at::date = d::date)) order by d), '[]'::jsonb)
        from generate_series(current_date - 13, current_date, interval '1 day') d)
  ) into r;
  return r;
end;
$$;

-- Members list with sign-in email (moderators only)
create or replace function public.forum_admin_members(p_q text default null, p_filter text default 'all', p_limit int default 30, p_offset int default 0)
returns table (user_id uuid, display_name text, email text, headline text, location text, verification_status text,
  is_suspended boolean, suspended_reason text, suspended_at timestamptz, created_at timestamptz, last_sign_in_at timestamptz, posts bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.forum_is_staff() then raise exception 'Moderators only.' using errcode = '42501'; end if;
  return query
  select p.user_id, p.display_name, u.email::text, p.headline, p.location, p.verification_status, p.is_suspended, p.suspended_reason, p.suspended_at,
    p.created_at, u.last_sign_in_at, (select count(*) from forum_posts x where x.author_id = p.user_id)
  from forum_profiles p join auth.users u on u.id = p.user_id
  where (coalesce(btrim(p_q), '') = '' or p.display_name ilike '%' || btrim(p_q) || '%' or u.email ilike '%' || btrim(p_q) || '%')
    and (p_filter = 'all' or (p_filter = 'suspended' and p.is_suspended) or (p_filter = 'pending' and p.verification_status = 'pending')
      or (p_filter = 'approved' and p.verification_status = 'approved' and not p.is_suspended))
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.forum_admin_suspend(p_user uuid, p_on boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.forum_is_staff() then raise exception 'Moderators only.' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'You cannot suspend your own account.'; end if;
  if p_on and char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Give a short reason for the suspension.'; end if;
  update forum_profiles set is_suspended = p_on, suspended_at = case when p_on then now() else null end,
    suspended_reason = case when p_on then left(btrim(p_reason), 300) else null end
  where user_id = p_user;
  if not found then raise exception 'Member not found.'; end if;
  -- A suspended member is signed out of the Forum on every device.
  if p_on then delete from forum_trusted_sessions where user_id = p_user; end if;
end;
$$;

-- Reports queue (open reports grouped per post)
create or replace function public.forum_admin_reports(p_resolved boolean default false)
returns table (post_id uuid, body text, kind text, is_hidden boolean, post_created_at timestamptz, author_id uuid, author_name text,
  reports bigint, reasons text[], last_reported_at timestamptz, report_ids uuid[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.forum_is_staff() then raise exception 'Moderators only.' using errcode = '42501'; end if;
  return query
  select p.id, p.body, p.kind, p.is_hidden, p.created_at, p.author_id, a.display_name,
    count(r.id), array_agg(r.reason order by r.created_at desc), max(r.created_at), array_agg(r.id)
  from forum_reports r join forum_posts p on p.id = r.post_id left join forum_profiles a on a.user_id = p.author_id
  where r.resolved = p_resolved
  group by p.id, a.display_name
  order by count(r.id) desc, max(r.created_at) desc
  limit 100;
end;
$$;

revoke all on function public.forum_admin_stats() from public, anon;
revoke all on function public.forum_admin_members(text, text, int, int) from public, anon;
revoke all on function public.forum_admin_suspend(uuid, boolean, text) from public, anon;
revoke all on function public.forum_admin_reports(boolean) from public, anon;
grant execute on function public.forum_admin_stats() to authenticated;
grant execute on function public.forum_admin_members(text, text, int, int) to authenticated;
grant execute on function public.forum_admin_suspend(uuid, boolean, text) to authenticated;
grant execute on function public.forum_admin_reports(boolean) to authenticated;
