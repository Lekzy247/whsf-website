-- WHSF Forum: phone / browser push notifications (Web Push, owner request 2026-10-15).
-- A member turns them on under Me -> Phone notifications; the browser gives a push subscription (endpoint + keys),
-- stored here, one row per device. When an official WHSF account posts, api/official-post-email (already called by
-- the database through pg_net) also sends a push to every subscribed member through forum_official_post_push, which
-- checks the sync secret and returns the subscriptions only once per post. Dead subscriptions (the push service
-- answers 404 / 410) are removed with forum_push_drop. VAPID keys live in Vercel (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).

create table if not exists public.forum_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 40 and 200),
  auth text not null check (char_length(auth) between 10 and 100),
  device_label text check (char_length(device_label) <= 120),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);
create index if not exists forum_push_subscriptions_user on public.forum_push_subscriptions (user_id);
alter table public.forum_push_subscriptions enable row level security;
drop policy if exists "Members manage own push subscriptions" on public.forum_push_subscriptions;
create policy "Members manage own push subscriptions" on public.forum_push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.forum_is_member());

alter table public.forum_official_emails add column if not exists pushed_at timestamptz;
alter table public.forum_official_emails add column if not exists pushes integer not null default 0;

-- Subscriptions for an official post, once. The row in forum_official_emails is created by forum_official_post_mail,
-- which api/official-post-email calls first.
create or replace function public.forum_official_post_push(p_secret text, p_post uuid)
returns table (title text, body text, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.forum_job_sync_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from forum_posts x where x.id = p_post and not x.is_hidden and public.forum_is_official(x.author_id)) then return; end if;
  insert into forum_official_emails (post_id) values (p_post) on conflict do nothing;
  update forum_official_emails set pushed_at = now() where post_id = p_post and pushed_at is null;
  if not found then return; end if;
  return query
    select coalesce(a.display_name, 'WHSF') || ' posted', x.body, s.endpoint, s.p256dh, s.auth
    from forum_posts x
    join forum_profiles a on a.user_id = x.author_id
    join forum_profiles p on p.user_id <> x.author_id and p.verification_status = 'approved' and not p.is_suspended
    join forum_push_subscriptions s on s.user_id = p.user_id
    where x.id = p_post;
end $$;
revoke all on function public.forum_official_post_push(text, uuid) from public;
grant execute on function public.forum_official_post_push(text, uuid) to anon, authenticated;

create or replace function public.forum_push_done(p_secret text, p_post uuid, p_sent integer, p_dead text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.forum_job_sync_ok(p_secret) then raise exception 'not allowed' using errcode = '42501'; end if;
  update forum_official_emails set pushes = greatest(p_sent, 0) where post_id = p_post;
  delete from forum_push_subscriptions where endpoint = any(coalesce(p_dead, '{}'));
end $$;
revoke all on function public.forum_push_done(text, uuid, integer, text[]) from public;
grant execute on function public.forum_push_done(text, uuid, integer, text[]) to anon, authenticated;
