-- WHSF Forum: richer posts. Polls, documents (PDF), video, event announcements and collaboration requests.
-- Files live in the private bucket forum-files (members only, signed links). The database checks the real
-- stored file (size + type from storage) before a post can point to it.

alter table public.forum_posts drop constraint if exists forum_posts_kind_check;
alter table public.forum_posts add constraint forum_posts_kind_check check (kind in ('post', 'celebrate', 'poll', 'event', 'collab'));

alter table public.forum_posts
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_kind text,
  add column if not exists attachment_size bigint,
  add column if not exists event_id uuid references public.forum_events(id) on delete set null,
  add column if not exists poll_closes_at timestamptz,
  add column if not exists collab_need text,
  add column if not exists collab_skills text[] not null default '{}',
  add column if not exists collab_deadline date,
  add column if not exists collab_where text;

alter table public.forum_posts drop constraint if exists forum_posts_attachment_check;
alter table public.forum_posts add constraint forum_posts_attachment_check check (
  (attachment_path is null and attachment_name is null and attachment_kind is null and attachment_size is null)
  or (attachment_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|mp4|webm|mov)$'
      and attachment_kind in ('document', 'video')
      and char_length(attachment_name) between 1 and 120
      and attachment_size between 1 and 52428800));
alter table public.forum_posts drop constraint if exists forum_posts_collab_check;
alter table public.forum_posts add constraint forum_posts_collab_check check (
  (kind <> 'collab' and collab_need is null)
  or (kind = 'collab' and collab_need is not null and collab_need in ('partner_org', 'volunteers', 'researcher', 'mentor', 'funding_partner', 'speaker', 'cofounder', 'other')
      and cardinality(collab_skills) <= 8 and (collab_where is null or char_length(collab_where) <= 80)));
alter table public.forum_posts drop constraint if exists forum_posts_event_kind_check;
alter table public.forum_posts add constraint forum_posts_event_kind_check check (event_id is null or kind = 'event');

-- Private bucket for documents and videos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forum-files', 'forum-files', false, 52428800, array['application/pdf', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Forum files: members upload own" on storage.objects;
create policy "Forum files: members upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'forum-files' and (storage.foldername(name))[1] = auth.uid()::text and public.forum_is_member());
drop policy if exists "Forum files: members view" on storage.objects;
create policy "Forum files: members view" on storage.objects for select to authenticated
  using (bucket_id = 'forum-files' and (public.forum_is_member() or public.forum_is_staff()));
drop policy if exists "Forum files: owner or moderator deletes" on storage.objects;
create policy "Forum files: owner or moderator deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'forum-files' and ((storage.foldername(name))[1] = auth.uid()::text or public.forum_is_staff()));

-- Post guard: checks the attached file and the announced event; rich fields cannot be changed after posting.
create or replace function public.forum_posts_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_size bigint; v_mime text;
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.forum_posts where author_id = new.author_id and created_at > now() - interval '24 hours') >= 20 then
      raise exception 'Posting limit reached (20 posts a day). Please try again tomorrow.';
    end if;
    new.is_hidden := false; new.hidden_reason := null; new.created_at := now();
    new.edited_at := null; new.is_pinned := false;
    if new.attachment_path is not null then
      if split_part(new.attachment_path, '/', 1) <> new.author_id::text then raise exception 'Invalid file.'; end if;
      select (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype' into v_size, v_mime
        from storage.objects o where o.bucket_id = 'forum-files' and o.name = new.attachment_path;
      if v_size is null then raise exception 'The file was not uploaded. Please try again.'; end if;
      if new.attachment_kind = 'document' and (v_mime <> 'application/pdf' or v_size > 10485760) then
        raise exception 'Documents must be PDF files of 10 MB or less.';
      end if;
      if new.attachment_kind = 'video' and (v_mime not in ('video/mp4', 'video/webm', 'video/quicktime') or v_size > 52428800) then
        raise exception 'Videos must be MP4, WebM or MOV files of 50 MB or less.';
      end if;
      new.attachment_size := v_size;
    end if;
    if new.kind = 'event' and new.event_id is null then raise exception 'Choose the event to announce.'; end if;
    if new.event_id is not null and not exists (
      select 1 from public.forum_events e where e.id = new.event_id and (e.status = 'published' or e.host_id = new.author_id) and e.ends_at > now()
    ) then raise exception 'Choose an upcoming published event.'; end if;
    if new.kind = 'poll' and coalesce(current_setting('whsf.forum_poll_rpc', true), '') <> 'on' then
      raise exception 'Create polls with the poll tool.';
    end if;
    return new;
  end if;
  new.id := old.id; new.author_id := old.author_id; new.created_at := old.created_at;
  new.attachment_path := old.attachment_path; new.attachment_name := old.attachment_name;
  new.attachment_kind := old.attachment_kind; new.attachment_size := old.attachment_size;
  new.event_id := old.event_id; new.poll_closes_at := old.poll_closes_at;
  if not public.forum_is_staff() then
    new.is_hidden := old.is_hidden; new.hidden_reason := old.hidden_reason;
    new.is_pinned := old.is_pinned; new.kind := old.kind; new.image_url := old.image_url;
  end if;
  if new.body is distinct from old.body or new.topic is distinct from old.topic or new.location is distinct from old.location
     or new.collab_need is distinct from old.collab_need or new.collab_skills is distinct from old.collab_skills
     or new.collab_deadline is distinct from old.collab_deadline or new.collab_where is distinct from old.collab_where then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;

-- Polls
create table if not exists public.forum_poll_options (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  position smallint not null check (position between 1 and 6),
  label text not null check (char_length(btrim(label)) between 1 and 100),
  unique (post_id, position)
);
create table if not exists public.forum_poll_votes (
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  option_id uuid not null references public.forum_poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.forum_poll_options enable row level security;
alter table public.forum_poll_votes enable row level security;
revoke all on public.forum_poll_options, public.forum_poll_votes from anon, authenticated;

create or replace function public.forum_create_poll(p_body text, p_topic text, p_options text[], p_closes_at timestamptz, p_location text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_opts text[]; i int;
begin
  if not public.forum_is_member() then raise exception 'Only verified members can post.' using errcode = '42501'; end if;
  select array_agg(btrim(o)) into v_opts from unnest(p_options) o where btrim(o) <> '';
  if coalesce(array_length(v_opts, 1), 0) < 2 or array_length(v_opts, 1) > 6 then raise exception 'A poll needs 2 to 6 choices.'; end if;
  if (select count(distinct lower(o)) from unnest(v_opts) o) <> array_length(v_opts, 1) then raise exception 'Each choice must be different.'; end if;
  if exists (select 1 from unnest(v_opts) o where char_length(o) > 100) then raise exception 'Choices can be up to 100 characters.'; end if;
  if p_closes_at is null or p_closes_at < now() + interval '1 hour' or p_closes_at > now() + interval '31 days' then
    raise exception 'Choose how long the poll stays open (1 hour to 30 days).';
  end if;
  perform set_config('whsf.forum_poll_rpc', 'on', true);
  insert into forum_posts (author_id, body, kind, topic, location, poll_closes_at)
  values (auth.uid(), p_body, 'poll', coalesce(p_topic, 'general'), nullif(btrim(coalesce(p_location, '')), ''), p_closes_at)
  returning id into v_id;
  perform set_config('whsf.forum_poll_rpc', 'off', true);
  for i in 1 .. array_length(v_opts, 1) loop
    insert into forum_poll_options (post_id, position, label) values (v_id, i, v_opts[i]);
  end loop;
  return v_id;
end;
$$;

create or replace function public.forum_poll_vote(p_post uuid, p_option uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p forum_posts;
begin
  if not public.forum_is_member() then raise exception 'Only verified members can vote.' using errcode = '42501'; end if;
  select * into p from forum_posts where id = p_post;
  if p.id is null or p.kind <> 'poll' or p.is_hidden then raise exception 'This poll is not available.'; end if;
  if p.poll_closes_at <= now() then raise exception 'This poll has closed.'; end if;
  if p_option is null then delete from forum_poll_votes where post_id = p_post and user_id = auth.uid(); return; end if;
  if not exists (select 1 from forum_poll_options where id = p_option and post_id = p_post) then raise exception 'Invalid choice.'; end if;
  insert into forum_poll_votes (post_id, option_id, user_id) values (p_post, p_option, auth.uid())
    on conflict (post_id, user_id) do update set option_id = excluded.option_id, created_at = now();
end;
$$;

create or replace function public.forum_poll_results(p_ids uuid[])
returns table (post_id uuid, option_id uuid, opt_position smallint, label text, votes bigint, mine boolean)
language sql stable security definer set search_path = public as $$
  select o.post_id, o.id, o.position, o.label,
    (select count(*) from forum_poll_votes v where v.option_id = o.id),
    exists (select 1 from forum_poll_votes v where v.option_id = o.id and v.user_id = auth.uid())
  from forum_poll_options o
  join forum_posts p on p.id = o.post_id
  where o.post_id = any (p_ids[1:60]) and (public.forum_is_staff() or (public.forum_is_member() and (not p.is_hidden or p.author_id = auth.uid())))
  order by o.post_id, o.position;
$$;

revoke all on function public.forum_create_poll(text, text, text[], timestamptz, text) from public, anon;
revoke all on function public.forum_poll_vote(uuid, uuid) from public, anon;
revoke all on function public.forum_poll_results(uuid[]) from public, anon;
grant execute on function public.forum_create_poll(text, text, text[], timestamptz, text) to authenticated;
grant execute on function public.forum_poll_vote(uuid, uuid) to authenticated;
grant execute on function public.forum_poll_results(uuid[]) to authenticated;
