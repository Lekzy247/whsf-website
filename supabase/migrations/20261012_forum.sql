-- WHSF Forum, phase 1: adult-only (18+) community with profiles, posts, follows and reports.
-- Members only: posts and profiles are readable by signed-in members (and WHSF moderators), not the public.
-- Moderators are WHSF accounts with app_metadata.role admin/teacher (public.whsf_is_staff()).
-- Date of birth is checked once in forum_join() and NOT stored; only the confirmation time is kept.

create table if not exists public.forum_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
  headline text check (headline is null or char_length(headline) <= 120),
  location text check (location is null or char_length(location) <= 80),
  about text check (about is null or char_length(about) <= 1000),
  avatar_url text check (avatar_url is null or avatar_url like 'https://ophymlgqnfilgxsuzcuz.supabase.co/storage/v1/object/public/forum-images/%'),
  adult_confirmed_at timestamptz not null,
  rules_accepted_at timestamptz not null,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.forum_profiles (user_id) on delete cascade,
  kind text not null default 'post' check (kind in ('post', 'celebrate')),
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  image_url text check (image_url is null or image_url like 'https://ophymlgqnfilgxsuzcuz.supabase.co/storage/v1/object/public/forum-images/%'),
  location text check (location is null or char_length(location) <= 80),
  is_hidden boolean not null default false,
  hidden_reason text check (hidden_reason is null or char_length(hidden_reason) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists forum_posts_created_idx on public.forum_posts (created_at desc);
create index if not exists forum_posts_author_idx on public.forum_posts (author_id, created_at desc);

create table if not exists public.forum_follows (
  follower_id uuid not null references public.forum_profiles (user_id) on delete cascade,
  followee_id uuid not null references public.forum_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists forum_follows_followee_idx on public.forum_follows (followee_id);

create table if not exists public.forum_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts (id) on delete cascade,
  reporter_id uuid not null references public.forum_profiles (user_id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

-- Is the caller an active (not suspended) forum member?
create or replace function public.forum_is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.forum_profiles p where p.user_id = auth.uid() and not p.is_suspended);
$$;
revoke all on function public.forum_is_member() from public, anon;
grant execute on function public.forum_is_member() to authenticated;

-- Join the forum (18+ only). Birth date is validated here and not stored.
create or replace function public.forum_join(p_display_name text, p_headline text, p_location text, p_birth_date date, p_accept_rules boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if coalesce(p_accept_rules, false) is not true then raise exception 'Please accept the community rules.'; end if;
  if p_birth_date is null or p_birth_date > (current_date - interval '18 years')::date or p_birth_date < date '1900-01-01' then
    raise exception 'The WHSF Forum is for adults aged 18 and over.';
  end if;
  insert into public.forum_profiles (user_id, display_name, headline, location, adult_confirmed_at, rules_accepted_at)
  values (auth.uid(), btrim(p_display_name), nullif(btrim(p_headline), ''), nullif(btrim(p_location), ''), now(), now())
  on conflict (user_id) do update
    set display_name = excluded.display_name, headline = excluded.headline, location = excluded.location, updated_at = now();
end;
$$;
revoke all on function public.forum_join(text, text, text, date, boolean) from public, anon;
grant execute on function public.forum_join(text, text, text, date, boolean) to authenticated;

-- Members cannot change moderation or consent fields on their own profile.
create or replace function public.forum_profiles_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.whsf_is_staff() then
    new.is_suspended := old.is_suspended;
    new.adult_confirmed_at := old.adult_confirmed_at;
    new.rules_accepted_at := old.rules_accepted_at;
    new.user_id := old.user_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists forum_profiles_guard on public.forum_profiles;
create trigger forum_profiles_guard before update on public.forum_profiles
  for each row execute function public.forum_profiles_guard();

-- Posts: members can't hide/unhide their own posts; max 20 posts per member per 24 hours.
create or replace function public.forum_posts_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.forum_posts where author_id = new.author_id and created_at > now() - interval '24 hours') >= 20 then
      raise exception 'Posting limit reached (20 posts a day). Please try again tomorrow.';
    end if;
    new.is_hidden := false; new.hidden_reason := null; new.created_at := now();
  elsif tg_op = 'UPDATE' and not public.whsf_is_staff() then
    new.is_hidden := old.is_hidden; new.hidden_reason := old.hidden_reason;
    new.author_id := old.author_id; new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists forum_posts_guard on public.forum_posts;
create trigger forum_posts_guard before insert or update on public.forum_posts
  for each row execute function public.forum_posts_guard();

alter table public.forum_profiles enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_follows enable row level security;
alter table public.forum_reports enable row level security;

revoke all on public.forum_profiles, public.forum_posts, public.forum_follows, public.forum_reports from anon;

-- Profiles
drop policy if exists "Members read profiles" on public.forum_profiles;
create policy "Members read profiles" on public.forum_profiles for select to authenticated
  using (public.forum_is_member() or public.whsf_is_staff() or user_id = auth.uid());
drop policy if exists "Members update own profile" on public.forum_profiles;
create policy "Members update own profile" on public.forum_profiles for update to authenticated
  using (user_id = auth.uid() or public.whsf_is_staff()) with check (user_id = auth.uid() or public.whsf_is_staff());
drop policy if exists "Members delete own profile" on public.forum_profiles;
create policy "Members delete own profile" on public.forum_profiles for delete to authenticated
  using (user_id = auth.uid());
-- (Profiles are created only through forum_join(); no insert policy.)

-- Posts
drop policy if exists "Members read posts" on public.forum_posts;
create policy "Members read posts" on public.forum_posts for select to authenticated
  using (public.whsf_is_staff() or (public.forum_is_member() and (not is_hidden or author_id = auth.uid())));
drop policy if exists "Members create own posts" on public.forum_posts;
create policy "Members create own posts" on public.forum_posts for insert to authenticated
  with check (author_id = auth.uid() and public.forum_is_member());
drop policy if exists "Moderators update posts" on public.forum_posts;
create policy "Moderators update posts" on public.forum_posts for update to authenticated
  using (public.whsf_is_staff()) with check (public.whsf_is_staff());
drop policy if exists "Authors or moderators delete posts" on public.forum_posts;
create policy "Authors or moderators delete posts" on public.forum_posts for delete to authenticated
  using (author_id = auth.uid() or public.whsf_is_staff());

-- Follows
drop policy if exists "Members read follows" on public.forum_follows;
create policy "Members read follows" on public.forum_follows for select to authenticated
  using (public.forum_is_member() or public.whsf_is_staff());
drop policy if exists "Members follow" on public.forum_follows;
create policy "Members follow" on public.forum_follows for insert to authenticated
  with check (follower_id = auth.uid() and public.forum_is_member());
drop policy if exists "Members unfollow" on public.forum_follows;
create policy "Members unfollow" on public.forum_follows for delete to authenticated
  using (follower_id = auth.uid());

-- Reports
drop policy if exists "Members report posts" on public.forum_reports;
create policy "Members report posts" on public.forum_reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.forum_is_member());
drop policy if exists "Moderators read reports" on public.forum_reports;
create policy "Moderators read reports" on public.forum_reports for select to authenticated
  using (public.whsf_is_staff() or reporter_id = auth.uid());
drop policy if exists "Moderators resolve reports" on public.forum_reports;
create policy "Moderators resolve reports" on public.forum_reports for update to authenticated
  using (public.whsf_is_staff()) with check (public.whsf_is_staff());

grant select, update, delete on public.forum_profiles to authenticated;
grant select, insert, update, delete on public.forum_posts to authenticated;
grant select, insert, delete on public.forum_follows to authenticated;
grant select, insert, update on public.forum_reports to authenticated;

-- Images: public-read bucket; members upload only into their own folder; 5 MB; images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forum-images', 'forum-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists "Forum members upload own images" on storage.objects;
create policy "Forum members upload own images" on storage.objects for insert to authenticated
  with check (bucket_id = 'forum-images' and (storage.foldername(name))[1] = auth.uid()::text and public.forum_is_member());
drop policy if exists "Forum members delete own images" on storage.objects;
create policy "Forum members delete own images" on storage.objects for delete to authenticated
  using (bucket_id = 'forum-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.whsf_is_staff()));

-- Trigger functions are not callable through the API.
revoke all on function public.forum_posts_guard() from public, anon, authenticated;
revoke all on function public.forum_profiles_guard() from public, anon, authenticated;
