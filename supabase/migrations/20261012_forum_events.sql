-- WHSF Forum part 3: events hosted by verified members, free registration with a ticket code, check-in.
-- New events wait for WHSF moderator approval before members can see them (scam protection).
-- Online meeting links are private: only the host and registered attendees can read them.

create table if not exists public.forum_events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.forum_profiles (user_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  about text not null check (char_length(btrim(about)) between 20 and 4000),
  format text not null check (format in ('in_person', 'online', 'hybrid')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_zone text not null default 'UTC' check (char_length(time_zone) <= 64),
  venue_name text check (venue_name is null or char_length(venue_name) <= 120),
  address text check (address is null or char_length(address) <= 200),
  city text check (city is null or char_length(city) <= 80),
  country text check (country is null or char_length(country) <= 80),
  livestream_url text check (livestream_url is null or (livestream_url ~ '^https://\S+$' and char_length(livestream_url) between 12 and 500)),
  capacity integer check (capacity is null or capacity between 1 and 100000),
  cover_url text check (cover_url is null or cover_url like 'https://ophymlgqnfilgxsuzcuz.supabase.co/storage/v1/object/public/forum-images/%'),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected', 'cancelled')),
  review_note text check (review_note is null or char_length(review_note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists forum_events_starts_idx on public.forum_events (status, starts_at);
create index if not exists forum_events_host_idx on public.forum_events (host_id, starts_at desc);

create table if not exists public.forum_event_private (
  event_id uuid primary key references public.forum_events (id) on delete cascade,
  meeting_link text check (meeting_link is null or (meeting_link ~ '^https://\S+$' and char_length(meeting_link) between 12 and 500))
);

create table if not exists public.forum_tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.forum_events (id) on delete cascade,
  holder_id uuid not null references public.forum_profiles (user_id) on delete cascade,
  code text not null unique,
  status text not null default 'registered' check (status in ('registered', 'cancelled', 'checked_in')),
  created_at timestamptz not null default now(),
  checked_in_at timestamptz
);
create unique index if not exists forum_tickets_one_active on public.forum_tickets (event_id, holder_id) where status <> 'cancelled';
create index if not exists forum_tickets_holder_idx on public.forum_tickets (holder_id, created_at desc);

alter table public.forum_events enable row level security;
alter table public.forum_event_private enable row level security;
alter table public.forum_tickets enable row level security;
revoke all on public.forum_events, public.forum_event_private, public.forum_tickets from anon, authenticated;

-- Events: members see published ones; hosts see their own; moderators see all.
drop policy if exists "Read events" on public.forum_events;
create policy "Read events" on public.forum_events for select to authenticated
  using (public.whsf_is_staff() or host_id = auth.uid() or (status = 'published' and public.forum_is_member()));
drop policy if exists "Members create events" on public.forum_events;
create policy "Members create events" on public.forum_events for insert to authenticated
  with check (host_id = auth.uid() and public.forum_is_member());
drop policy if exists "Hosts and moderators update events" on public.forum_events;
create policy "Hosts and moderators update events" on public.forum_events for update to authenticated
  using (host_id = auth.uid() or public.whsf_is_staff()) with check (host_id = auth.uid() or public.whsf_is_staff());
grant select, insert, update on public.forum_events to authenticated;

-- Guard: hosts cannot approve their own events, change the host, or move times into the past.
-- At most 5 new events per member per week.
create or replace function public.forum_events_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from forum_events where host_id = new.host_id and created_at > now() - interval '7 days') >= 5 then
      raise exception 'You can create up to 5 events a week. Please try again later.';
    end if;
    if new.starts_at < now() then raise exception 'The event must start in the future.'; end if;
    new.status := 'pending'; new.review_note := null; new.created_at := now();
  elsif not public.whsf_is_staff() then
    new.host_id := old.host_id;
    new.review_note := old.review_note;
    -- Hosts may cancel; any other status change is for moderators. Editing a rejected event sends it back for review.
    if new.status is distinct from old.status and new.status <> 'cancelled' then new.status := old.status; end if;
    if old.status = 'rejected' and new.status = 'rejected' then new.status := 'pending'; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists forum_events_guard on public.forum_events;
create trigger forum_events_guard before insert or update on public.forum_events for each row execute function public.forum_events_guard();
revoke all on function public.forum_events_guard() from public, anon, authenticated;

-- Private meeting link: host writes; host, moderators and registered attendees read.
drop policy if exists "Read meeting link" on public.forum_event_private;
create policy "Read meeting link" on public.forum_event_private for select to authenticated
  using (
    public.whsf_is_staff()
    or exists (select 1 from forum_events e where e.id = event_id and e.host_id = auth.uid())
    or exists (select 1 from forum_tickets t where t.event_id = forum_event_private.event_id and t.holder_id = auth.uid() and t.status <> 'cancelled')
  );
drop policy if exists "Host writes meeting link" on public.forum_event_private;
create policy "Host writes meeting link" on public.forum_event_private for all to authenticated
  using (exists (select 1 from forum_events e where e.id = event_id and e.host_id = auth.uid()))
  with check (exists (select 1 from forum_events e where e.id = event_id and e.host_id = auth.uid()));
grant select, insert, update, delete on public.forum_event_private to authenticated;

-- Tickets: holders see their own; hosts see their events' tickets; moderators see all. Changes via functions only.
drop policy if exists "Read tickets" on public.forum_tickets;
create policy "Read tickets" on public.forum_tickets for select to authenticated
  using (holder_id = auth.uid() or public.whsf_is_staff()
         or exists (select 1 from forum_events e where e.id = event_id and e.host_id = auth.uid()));
grant select on public.forum_tickets to authenticated;

-- Number of active registrations (for "x going" and capacity) without exposing who.
create or replace function public.forum_event_counts(p_ids uuid[])
returns table (event_id uuid, going bigint)
language sql stable security definer set search_path = public as $$
  select t.event_id, count(*) from forum_tickets t
  where t.event_id = any (p_ids) and t.status <> 'cancelled' and public.forum_is_member()
  group by t.event_id;
$$;
revoke all on function public.forum_event_counts(uuid[]) from public, anon;
grant execute on function public.forum_event_counts(uuid[]) to authenticated;

-- Register for a published, upcoming event (free). Returns the ticket code.
create or replace function public.forum_event_register(p_event uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); e forum_events; v_code text; v_going bigint; v_name text;
begin
  if not public.forum_is_member() then raise exception 'Only verified members can register.' using errcode = '42501'; end if;
  select * into e from forum_events where id = p_event for update;
  if e.id is null or e.status <> 'published' then raise exception 'This event is not open for registration.'; end if;
  if e.ends_at < now() then raise exception 'This event has ended.'; end if;
  if e.host_id = v_me then raise exception 'You are hosting this event.'; end if;
  select code into v_code from forum_tickets where event_id = p_event and holder_id = v_me and status <> 'cancelled';
  if v_code is not null then return v_code; end if;
  select count(*) into v_going from forum_tickets where event_id = p_event and status <> 'cancelled';
  if e.capacity is not null and v_going >= e.capacity then raise exception 'Sorry, this event is full.'; end if;
  v_code := 'WHSF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into forum_tickets (event_id, holder_id, code) values (p_event, v_me, v_code);
  select display_name into v_name from forum_profiles where user_id = v_me;
  insert into forum_notifications (user_id, kind, actor_id, body, link)
  values (e.host_id, 'event_registration', v_me, left(coalesce(v_name, 'A member'), 80) || ' registered for ' || left(e.title, 120), '#events/' || e.id);
  return v_code;
end;
$$;
revoke all on function public.forum_event_register(uuid) from public, anon;
grant execute on function public.forum_event_register(uuid) to authenticated;

create or replace function public.forum_ticket_cancel(p_ticket uuid)
returns void language sql security definer set search_path = public as $$
  update forum_tickets set status = 'cancelled' where id = p_ticket and holder_id = auth.uid() and status = 'registered';
$$;
revoke all on function public.forum_ticket_cancel(uuid) from public, anon;
grant execute on function public.forum_ticket_cancel(uuid) to authenticated;

-- Host (or moderator) checks a guest in by ticket code. Returns the guest's name.
create or replace function public.forum_check_in(p_event uuid, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_ticket forum_tickets; v_name text;
begin
  if not (public.whsf_is_staff() or exists (select 1 from forum_events where id = p_event and host_id = auth.uid())) then
    raise exception 'Only the host can check guests in.' using errcode = '42501';
  end if;
  select * into v_ticket from forum_tickets where event_id = p_event and code = upper(btrim(p_code));
  if v_ticket.id is null then raise exception 'No ticket with that code for this event.'; end if;
  if v_ticket.status = 'cancelled' then raise exception 'That ticket was cancelled.'; end if;
  select display_name into v_name from forum_profiles where user_id = v_ticket.holder_id;
  if v_ticket.status = 'checked_in' then return coalesce(v_name, 'Guest') || ' (already checked in)'; end if;
  update forum_tickets set status = 'checked_in', checked_in_at = now() where id = v_ticket.id;
  return coalesce(v_name, 'Guest');
end;
$$;
revoke all on function public.forum_check_in(uuid, text) from public, anon;
grant execute on function public.forum_check_in(uuid, text) to authenticated;

-- Moderator decision on a new event; tells the host.
create or replace function public.forum_event_review(p_event uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare e forum_events;
begin
  if not public.whsf_is_staff() then raise exception 'Moderators only.' using errcode = '42501'; end if;
  select * into e from forum_events where id = p_event and status = 'pending';
  if e.id is null then raise exception 'This event is not waiting for review.'; end if;
  if not p_approve and char_length(btrim(coalesce(p_note, ''))) < 3 then raise exception 'Give the host a short reason.'; end if;
  update forum_events set status = case when p_approve then 'published' else 'rejected' end,
    review_note = case when p_approve then null else left(btrim(p_note), 300) end
  where id = p_event;
  insert into forum_notifications (user_id, kind, body, link)
  values (e.host_id, 'event_update',
    case when p_approve then 'Your event "' || left(e.title, 120) || '" is approved and now visible to members.'
         else 'Your event "' || left(e.title, 100) || '" was not approved: ' || left(btrim(p_note), 120) end,
    '#events/' || e.id);
end;
$$;
revoke all on function public.forum_event_review(uuid, boolean, text) from public, anon;
grant execute on function public.forum_event_review(uuid, boolean, text) to authenticated;

-- Event cancelled: tell everyone registered.
create or replace function public.forum_event_cancelled_alert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'cancelled' and new.status = 'cancelled' then
    insert into forum_notifications (user_id, kind, body, link)
    select t.holder_id, 'event_update', 'The event "' || left(new.title, 120) || '" was cancelled by the host.', '#events/' || new.id
    from forum_tickets t where t.event_id = new.id and t.status <> 'cancelled';
  end if;
  return new;
end;
$$;
drop trigger if exists forum_event_cancelled_alert on public.forum_events;
create trigger forum_event_cancelled_alert after update of status on public.forum_events for each row execute function public.forum_event_cancelled_alert();
revoke all on function public.forum_event_cancelled_alert() from public, anon, authenticated;
