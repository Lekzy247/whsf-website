-- Share counts for forum posts (Facebook-style "N shares"). One row per member, post and channel,
-- so sharing the same post the same way twice is not double counted. Applied 2026-10-13.
create table if not exists public.forum_shares (
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references public.forum_profiles(user_id) on delete cascade,
  channel text not null check (channel in ('link', 'device', 'whatsapp', 'facebook', 'linkedin', 'x', 'email')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, channel)
);
alter table public.forum_shares enable row level security;
revoke all on public.forum_shares from anon;
create policy "Members record shares" on public.forum_shares for insert to authenticated
  with check (user_id = auth.uid() and public.forum_is_member()
              and exists (select 1 from public.forum_posts p where p.id = post_id));
create policy "Members read own shares" on public.forum_shares for select to authenticated
  using (user_id = auth.uid() or public.whsf_is_staff());

-- Members see share totals, not who shared.
create or replace function public.forum_share_count(p_post uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when public.forum_is_member() or public.whsf_is_staff()
              then (select count(*)::int from public.forum_shares where post_id = p_post) else 0 end;
$$;
revoke all on function public.forum_share_count(uuid) from public, anon;
grant execute on function public.forum_share_count(uuid) to authenticated;

drop function if exists public.forum_post_stats(uuid[]);
create function public.forum_post_stats(p_ids uuid[])
returns table (post_id uuid, reactions jsonb, reaction_total int, comment_total int, share_total int, my_reaction text, saved boolean)
language sql stable security invoker set search_path = public as $$
  select p.id,
    coalesce((select jsonb_object_agg(x.kind, x.n) from (
      select r.kind, count(*) as n from public.forum_reactions r where r.post_id = p.id group by r.kind) x), '{}'::jsonb),
    (select count(*)::int from public.forum_reactions r where r.post_id = p.id),
    (select count(*)::int from public.forum_comments c where c.post_id = p.id and not c.is_hidden),
    public.forum_share_count(p.id),
    (select r.kind from public.forum_reactions r where r.post_id = p.id and r.user_id = auth.uid()),
    exists (select 1 from public.forum_saves s where s.post_id = p.id and s.user_id = auth.uid())
  from public.forum_posts p
  where p.id = any (p_ids[1:50]);
$$;
revoke all on function public.forum_post_stats(uuid[]) from public, anon;
grant execute on function public.forum_post_stats(uuid[]) to authenticated;
