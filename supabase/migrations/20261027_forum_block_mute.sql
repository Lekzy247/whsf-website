-- WHSF Forum: Block & Mute (owner request 2026-10-15).
-- Mute  = you stop seeing that member's posts and comments; they are not told.
-- Block = works both ways: neither of you sees the other's posts, comments or alerts, and no messages can be sent
--         (also in a conversation that already existed). Blocking already stopped new conversations, connection and
--         mentor requests and suggestions (forum_is_blocked in those functions).
-- Official WHSF accounts and WHSF staff cannot be blocked or muted (safety notices must reach everyone).
-- Moderators (forum_is_staff) still see everything. Your own posts are always visible to you.

create table if not exists public.forum_mutes (
  muter_id uuid not null references auth.users(id) on delete cascade,
  muted_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id)
);
alter table public.forum_mutes enable row level security;
drop policy if exists "Members manage own mutes" on public.forum_mutes;
create policy "Members manage own mutes" on public.forum_mutes for all
  using (muter_id = auth.uid()) with check (muter_id = auth.uid() and public.forum_is_member());

create or replace function public.forum_has_muted(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from forum_mutes m where m.muter_id = auth.uid() and m.muted_id = p_user);
$$;

-- True when a member may not be blocked or muted: official WHSF account or WHSF staff (admin / teacher role).
create or replace function public.forum_user_protected(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.forum_is_official(p_user)
      or exists (select 1 from auth.users u where u.id = p_user and (u.raw_app_meta_data ->> 'role') in ('admin', 'teacher'));
$$;

create or replace function public.forum_block_mute_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb := to_jsonb(new); blocks boolean := tg_table_name = 'forum_blocks';
        target uuid := (r ->> case when blocks then 'blocked_id' else 'muted_id' end)::uuid;
        me uuid := (r ->> case when blocks then 'blocker_id' else 'muter_id' end)::uuid;
begin
  if target = me then raise exception 'You cannot % yourself.', case when blocks then 'block' else 'mute' end; end if;
  if public.forum_user_protected(target) then
    raise exception 'Official WHSF accounts and WHSF moderators cannot be blocked or muted. To report a problem, use Report on a post or email info@worldhsfoundation.org.';
  end if;
  return new;
end $$;
drop trigger if exists forum_blocks_guard on public.forum_blocks;
create trigger forum_blocks_guard before insert on public.forum_blocks for each row execute function public.forum_block_mute_guard();
drop trigger if exists forum_mutes_guard on public.forum_mutes;
create trigger forum_mutes_guard before insert on public.forum_mutes for each row execute function public.forum_block_mute_guard();

-- Posts and comments: hide blocked (either direction) and muted authors.
drop policy if exists "Members read posts" on public.forum_posts;
create policy "Members read posts" on public.forum_posts for select using (
  public.forum_is_staff()
  or (public.forum_is_member() and ((not is_hidden) or author_id = auth.uid())
      and (author_id = auth.uid() or (not public.forum_is_blocked(auth.uid(), author_id) and not public.forum_has_muted(author_id)))));

drop policy if exists "Members read comments" on public.forum_comments;
create policy "Members read comments" on public.forum_comments for select using (
  public.forum_is_staff()
  or (public.forum_is_member() and exists (select 1 from forum_posts p where p.id = forum_comments.post_id)
      and ((not is_hidden) or author_id = auth.uid())
      and (author_id = auth.uid() or (not public.forum_is_blocked(auth.uid(), author_id) and not public.forum_has_muted(author_id)))));

-- Alerts: nothing from someone you blocked or who blocked you.
drop policy if exists "Members read own alerts" on public.forum_notifications;
create policy "Members read own alerts" on public.forum_notifications for select using (
  user_id = auth.uid() and (actor_id is null or actor_id = user_id or not public.forum_is_blocked(user_id, actor_id)));

-- Messages: refuse when either side has blocked the other (also in older conversations).
create or replace function public.forum_messages_block_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare other uuid;
begin
  select case when t.member_a = new.sender_id then t.member_b else t.member_a end into other
    from forum_threads t where t.id = new.thread_id;
  if other is not null and public.forum_is_blocked(new.sender_id, other) then
    raise exception 'This message was not sent: one of you has blocked the other.';
  end if;
  return new;
end $$;
drop trigger if exists forum_messages_b_block_guard on public.forum_messages;
create trigger forum_messages_b_block_guard before insert on public.forum_messages
  for each row execute function public.forum_messages_block_guard();

-- The member's own lists, with names (for Me -> Blocked & muted).
create or replace function public.forum_my_blocks_and_mutes()
returns table (kind text, user_id uuid, display_name text, avatar_url text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select 'block', b.blocked_id, p.display_name, p.avatar_url, b.created_at
    from forum_blocks b left join forum_profiles p on p.user_id = b.blocked_id where b.blocker_id = auth.uid()
  union all
  select 'mute', m.muted_id, p.display_name, p.avatar_url, m.created_at
    from forum_mutes m left join forum_profiles p on p.user_id = m.muted_id where m.muter_id = auth.uid()
  order by 5 desc;
$$;
revoke all on function public.forum_my_blocks_and_mutes() from public, anon;
grant execute on function public.forum_my_blocks_and_mutes() to authenticated;
