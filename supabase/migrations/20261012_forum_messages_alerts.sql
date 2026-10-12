-- WHSF Forum part 2: private messages between verified members, blocking, and alerts (notifications).
-- Only the two people in a conversation can read it. Only verified (approved) members can message.

create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  member_a uuid not null references public.forum_profiles (user_id) on delete cascade,
  member_b uuid not null references public.forum_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (member_a < member_b),
  unique (member_a, member_b)
);
create index if not exists forum_threads_a_idx on public.forum_threads (member_a, last_message_at desc);
create index if not exists forum_threads_b_idx on public.forum_threads (member_b, last_message_at desc);

create table if not exists public.forum_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads (id) on delete cascade,
  sender_id uuid not null references public.forum_profiles (user_id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists forum_messages_thread_idx on public.forum_messages (thread_id, created_at);

create table if not exists public.forum_blocks (
  blocker_id uuid not null references public.forum_profiles (user_id) on delete cascade,
  blocked_id uuid not null references public.forum_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.forum_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.forum_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('follow', 'message', 'id_approved', 'id_rejected', 'event_registration', 'event_update', 'advert_approved', 'advert_rejected', 'invite_joined')),
  actor_id uuid references public.forum_profiles (user_id) on delete set null,
  body text not null check (char_length(body) <= 300),
  link text check (link is null or link ~ '^#[a-z0-9/_-]*$'),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists forum_notifications_user_idx on public.forum_notifications (user_id, created_at desc);

alter table public.forum_threads enable row level security;
alter table public.forum_messages enable row level security;
alter table public.forum_blocks enable row level security;
alter table public.forum_notifications enable row level security;
revoke all on public.forum_threads, public.forum_messages, public.forum_blocks, public.forum_notifications from anon;
revoke all on public.forum_threads, public.forum_messages, public.forum_blocks, public.forum_notifications from authenticated;

-- Is either person blocking the other?
create or replace function public.forum_is_blocked(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from forum_blocks where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a));
$$;
revoke all on function public.forum_is_blocked(uuid, uuid) from public, anon;
grant execute on function public.forum_is_blocked(uuid, uuid) to authenticated; -- used inside the message policy

-- Threads: participants read. Created only through forum_open_thread().
drop policy if exists "Participants read threads" on public.forum_threads;
create policy "Participants read threads" on public.forum_threads for select to authenticated
  using (public.forum_is_member() and auth.uid() in (member_a, member_b));
grant select on public.forum_threads to authenticated;

-- Messages: participants read; send only as yourself, as a member, when not blocked.
drop policy if exists "Participants read messages" on public.forum_messages;
create policy "Participants read messages" on public.forum_messages for select to authenticated
  using (public.forum_is_member() and exists (select 1 from forum_threads t where t.id = thread_id and auth.uid() in (t.member_a, t.member_b)));
drop policy if exists "Members send messages" on public.forum_messages;
create policy "Members send messages" on public.forum_messages for insert to authenticated
  with check (
    sender_id = auth.uid() and public.forum_is_member()
    and exists (select 1 from forum_threads t where t.id = thread_id and auth.uid() in (t.member_a, t.member_b)
                and not public.forum_is_blocked(t.member_a, t.member_b))
  );
grant select, insert on public.forum_messages to authenticated;

-- Blocks: manage your own.
drop policy if exists "Members manage own blocks" on public.forum_blocks;
create policy "Members manage own blocks" on public.forum_blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid() and public.forum_is_member());
grant select, insert, delete on public.forum_blocks to authenticated;

-- Notifications: read and mark read your own; created only by the functions/triggers below.
drop policy if exists "Members read own alerts" on public.forum_notifications;
create policy "Members read own alerts" on public.forum_notifications for select to authenticated
  using (user_id = auth.uid());
grant select on public.forum_notifications to authenticated;

-- Open (or reuse) a conversation with another verified member.
create or replace function public.forum_open_thread(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_a uuid; v_b uuid; v_id uuid;
begin
  if not public.forum_is_member() then raise exception 'Only verified members can send messages.' using errcode = '42501'; end if;
  if p_other is null or p_other = v_me then raise exception 'Choose someone to message.'; end if;
  if not exists (select 1 from forum_profiles where user_id = p_other and verification_status = 'approved' and not is_suspended) then
    raise exception 'This member cannot receive messages.';
  end if;
  if public.forum_is_blocked(v_me, p_other) then raise exception 'You cannot message this member.'; end if;
  v_a := least(v_me, p_other); v_b := greatest(v_me, p_other);
  insert into forum_threads (member_a, member_b) values (v_a, v_b)
  on conflict (member_a, member_b) do nothing;
  select id into v_id from forum_threads where member_a = v_a and member_b = v_b;
  return v_id;
end;
$$;
revoke all on function public.forum_open_thread(uuid) from public, anon;
grant execute on function public.forum_open_thread(uuid) to authenticated;

-- Mark a conversation as read (messages sent to me).
create or replace function public.forum_mark_thread_read(p_thread uuid)
returns void language sql security definer set search_path = public as $$
  update forum_messages m set read_at = now()
  from forum_threads t
  where m.thread_id = p_thread and t.id = m.thread_id and auth.uid() in (t.member_a, t.member_b)
    and m.sender_id <> auth.uid() and m.read_at is null;
$$;
revoke all on function public.forum_mark_thread_read(uuid) from public, anon;
grant execute on function public.forum_mark_thread_read(uuid) to authenticated;

create or replace function public.forum_mark_alerts_read()
returns void language sql security definer set search_path = public as $$
  update forum_notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;
revoke all on function public.forum_mark_alerts_read() from public, anon;
grant execute on function public.forum_mark_alerts_read() to authenticated;

-- Unread counts for the top bar badges.
create or replace function public.forum_unread_counts()
returns table (messages bigint, alerts bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from forum_messages m join forum_threads t on t.id = m.thread_id
      where auth.uid() in (t.member_a, t.member_b) and m.sender_id <> auth.uid() and m.read_at is null),
    (select count(*) from forum_notifications where user_id = auth.uid() and read_at is null);
$$;
revoke all on function public.forum_unread_counts() from public, anon;
grant execute on function public.forum_unread_counts() to authenticated;

-- Message guard: server time, at most 60 messages an hour, bump the thread, alert the other person
-- (one unread "message" alert per conversation at a time, so a chat doesn't flood their alerts).
create or replace function public.forum_messages_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_other uuid; v_name text;
begin
  if (select count(*) from forum_messages where sender_id = new.sender_id and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'You are sending messages too quickly. Please wait a little.';
  end if;
  new.created_at := now(); new.read_at := null;
  update forum_threads set last_message_at = now() where id = new.thread_id
    returning case when member_a = new.sender_id then member_b else member_a end into v_other;
  if not exists (select 1 from forum_notifications where user_id = v_other and kind = 'message' and actor_id = new.sender_id and read_at is null) then
    select display_name into v_name from forum_profiles where user_id = new.sender_id;
    insert into forum_notifications (user_id, kind, actor_id, body, link)
    values (v_other, 'message', new.sender_id, left(coalesce(v_name, 'A member'), 80) || ' sent you a message', '#messages');
  end if;
  return new;
end;
$$;
drop trigger if exists forum_messages_guard on public.forum_messages;
create trigger forum_messages_guard before insert on public.forum_messages for each row execute function public.forum_messages_guard();
revoke all on function public.forum_messages_guard() from public, anon, authenticated;

-- New follower alert.
create or replace function public.forum_follow_alert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select display_name into v_name from forum_profiles where user_id = new.follower_id;
  insert into forum_notifications (user_id, kind, actor_id, body, link)
  values (new.followee_id, 'follow', new.follower_id, left(coalesce(v_name, 'A member'), 80) || ' started following you', '#people');
  return new;
end;
$$;
drop trigger if exists forum_follow_alert on public.forum_follows;
create trigger forum_follow_alert after insert on public.forum_follows for each row execute function public.forum_follow_alert();
revoke all on function public.forum_follow_alert() from public, anon, authenticated;

-- ID check decided: tell the member.
create or replace function public.forum_id_decision_alert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' and new.status = 'approved' then
    insert into forum_notifications (user_id, kind, body, link)
    values (new.user_id, 'id_approved', 'Welcome! Your ID check was approved. You can now read, post and message members.', '#feed');
  elsif old.status = 'pending' and new.status = 'rejected' then
    insert into forum_notifications (user_id, kind, body, link)
    values (new.user_id, 'id_rejected', 'Your ID check was not approved: ' || left(coalesce(new.reject_reason, 'please try again'), 240) || '.', '#feed');
  end if;
  return new;
end;
$$;
drop trigger if exists forum_id_decision_alert on public.forum_id_checks;
create trigger forum_id_decision_alert after update of status on public.forum_id_checks for each row execute function public.forum_id_decision_alert();
revoke all on function public.forum_id_decision_alert() from public, anon, authenticated;
