-- WHSF Forum events, part 2: international-standard event pages (UN-style side events).
-- Adds: event types (side event, high-level, panel, roundtable, report launch, training), theme,
-- "on the margins of", lead organiser + co-organisers, SDGs, languages + interpretation, accessibility,
-- programme (agenda) and speakers, concept note / report / recording links, contact email, hashtag,
-- registration deadline, host approval of registrations, waitlist, and participant details
-- (organisation, title, country, participant type, accessibility needs, data consent).

-- ---------------------------------------------------------------- helpers to validate lists
create or replace function public.forum_text_items_ok(p_items text[], p_max int)
returns boolean language sql immutable as $$
  select coalesce(bool_and(char_length(btrim(x)) between 1 and p_max), true) from unnest(p_items) as x;
$$;
-- Every element is an object whose values are short strings, and only the allowed keys are used.
create or replace function public.forum_json_items_ok(p_items jsonb, p_keys text[], p_max int)
returns boolean language sql immutable as $$
  select jsonb_typeof(p_items) = 'array' and coalesce(bool_and(
    jsonb_typeof(e) = 'object'
    and (select coalesce(bool_and(k = any (p_keys) and jsonb_typeof(v) = 'string' and char_length(v #>> '{}') <= p_max), true)
         from jsonb_each(e) as kv(k, v))
  ), true)
  from jsonb_array_elements(p_items) as e;
$$;

-- ---------------------------------------------------------------- event fields
alter table public.forum_events drop constraint if exists forum_events_category_check;
alter table public.forum_events add constraint forum_events_category_check check (category in (
  'side_event', 'high_level', 'conference', 'summit', 'panel', 'roundtable', 'launch', 'training',
  'webinar', 'workshop', 'exchange', 'career_fair', 'networking', 'meetup'));

alter table public.forum_events
  add column if not exists theme text check (theme is null or char_length(theme) <= 200),
  add column if not exists parent_event text check (parent_event is null or char_length(parent_event) <= 160),
  add column if not exists organizer_name text check (organizer_name is null or char_length(organizer_name) <= 160),
  add column if not exists co_organizers text[] not null default '{}'
    check (cardinality(co_organizers) <= 15 and public.forum_text_items_ok(co_organizers, 160)),
  add column if not exists sdgs smallint[] not null default '{}'
    check (sdgs <@ '{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17}'::smallint[]),
  add column if not exists languages text[] not null default '{English}'
    check (cardinality(languages) between 1 and 8 and public.forum_text_items_ok(languages, 40)),
  add column if not exists interpretation text check (interpretation is null or char_length(interpretation) <= 200),
  add column if not exists accessibility text[] not null default '{}'
    check (accessibility <@ array['wheelchair', 'captions', 'sign_language', 'accessible_documents', 'hearing_loop', 'quiet_room']),
  add column if not exists registration_deadline timestamptz,
  add column if not exists approval_required boolean not null default false,
  add column if not exists contact_email text
    check (contact_email is null or (char_length(contact_email) <= 200 and contact_email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$')),
  add column if not exists concept_note_url text
    check (concept_note_url is null or (concept_note_url ~ '^https://\S+$' and char_length(concept_note_url) between 12 and 500)),
  add column if not exists report_url text
    check (report_url is null or (report_url ~ '^https://\S+$' and char_length(report_url) between 12 and 500)),
  add column if not exists recording_url text
    check (recording_url is null or (recording_url ~ '^https://\S+$' and char_length(recording_url) between 12 and 500)),
  add column if not exists hashtag text check (hashtag is null or hashtag ~ '^#[A-Za-z0-9_]{2,40}$'),
  add column if not exists agenda jsonb not null default '[]'
    check (jsonb_array_length(agenda) <= 40 and public.forum_json_items_ok(agenda, array['time', 'title', 'speakers'], 300)),
  add column if not exists speakers jsonb not null default '[]'
    check (jsonb_array_length(speakers) <= 40 and public.forum_json_items_ok(speakers, array['name', 'title', 'organization', 'role'], 160));

-- ---------------------------------------------------------------- participant details on tickets
alter table public.forum_tickets drop constraint if exists forum_tickets_status_check;
alter table public.forum_tickets add constraint forum_tickets_status_check
  check (status in ('pending', 'waitlisted', 'registered', 'checked_in', 'declined', 'cancelled'));
alter table public.forum_tickets
  add column if not exists organization text check (organization is null or char_length(organization) <= 160),
  add column if not exists job_title text check (job_title is null or char_length(job_title) <= 120),
  add column if not exists country text check (country is null or char_length(country) <= 80),
  add column if not exists participant_type text check (participant_type is null or participant_type in (
    'member_state', 'un_system', 'igo', 'ngo', 'academia', 'private_sector', 'media', 'individual', 'other')),
  add column if not exists access_needs text check (access_needs is null or char_length(access_needs) <= 300),
  add column if not exists consent_at timestamptz,
  add column if not exists decided_at timestamptz;

-- The online meeting link is only for confirmed guests (not pending or waitlisted).
drop policy if exists "Read meeting link" on public.forum_event_private;
create policy "Read meeting link" on public.forum_event_private for select to authenticated
  using (
    public.whsf_is_staff()
    or exists (select 1 from forum_events e where e.id = event_id and e.host_id = auth.uid())
    or exists (select 1 from forum_tickets t where t.event_id = forum_event_private.event_id and t.holder_id = auth.uid()
               and t.status in ('registered', 'checked_in'))
  );

-- ---------------------------------------------------------------- counts: confirmed, waitlist, awaiting approval
drop function if exists public.forum_event_counts(uuid[]);
create function public.forum_event_counts(p_ids uuid[])
returns table (event_id uuid, going bigint, waitlisted bigint, pending bigint)
language sql stable security definer set search_path = public as $$
  select t.event_id,
    count(*) filter (where t.status in ('registered', 'checked_in')),
    count(*) filter (where t.status = 'waitlisted'),
    count(*) filter (where t.status = 'pending')
  from forum_tickets t
  where t.event_id = any (p_ids) and (public.forum_is_member() or public.whsf_is_staff())
  group by t.event_id;
$$;
revoke all on function public.forum_event_counts(uuid[]) from public, anon;
grant execute on function public.forum_event_counts(uuid[]) to authenticated;

-- ---------------------------------------------------------------- registration with participant details
create or replace function public.forum_event_register_v2(p_event uuid, p_details jsonb)
returns table (code text, status text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_me uuid := auth.uid(); e forum_events; t forum_tickets; v_going bigint; v_status text; v_name text;
  v_org text := left(btrim(coalesce(p_details->>'organization', '')), 160);
  v_title text := nullif(left(btrim(coalesce(p_details->>'job_title', '')), 120), '');
  v_country text := left(btrim(coalesce(p_details->>'country', '')), 80);
  v_type text := p_details->>'participant_type';
  v_needs text := nullif(left(btrim(coalesce(p_details->>'access_needs', '')), 300), '');
begin
  if not public.forum_is_member() then raise exception 'Only verified members can register.' using errcode = '42501'; end if;
  select * into e from forum_events where id = p_event for update;
  if e.id is null or e.status <> 'published' then raise exception 'This event is not open for registration.'; end if;
  if e.ends_at < now() then raise exception 'This event has ended.'; end if;
  if e.registration_deadline is not null and e.registration_deadline < now() then raise exception 'Registration for this event has closed.'; end if;
  if e.host_id = v_me then raise exception 'You are hosting this event.'; end if;
  select * into t from forum_tickets where event_id = p_event and holder_id = v_me and forum_tickets.status <> 'cancelled';
  if t.id is not null then return query select t.code, t.status; return; end if;
  if char_length(v_org) < 2 then raise exception 'Please enter your organisation (or "Independent").'; end if;
  if char_length(v_country) < 2 then raise exception 'Please enter your country.'; end if;
  if v_type is null or v_type not in ('member_state', 'un_system', 'igo', 'ngo', 'academia', 'private_sector', 'media', 'individual', 'other') then
    raise exception 'Please choose how you are participating.';
  end if;
  if coalesce((p_details->>'consent')::boolean, false) is not true then
    raise exception 'Please agree to share your registration details with the organiser and WHSF.';
  end if;
  select count(*) into v_going from forum_tickets where event_id = p_event and forum_tickets.status in ('registered', 'checked_in');
  v_status := case
    when e.approval_required then 'pending'
    when e.capacity is not null and v_going >= e.capacity then 'waitlisted'
    else 'registered' end;
  t.code := 'WHSF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into forum_tickets (event_id, holder_id, code, status, organization, job_title, country, participant_type, access_needs, consent_at)
  values (p_event, v_me, t.code, v_status, v_org, v_title, v_country, v_type, v_needs, now());
  select display_name into v_name from forum_profiles where user_id = v_me;
  insert into forum_notifications (user_id, kind, actor_id, body, link)
  values (e.host_id, 'event_registration', v_me,
    left(coalesce(v_name, 'A member'), 80) || case v_status when 'pending' then ' asked to join ' when 'waitlisted' then ' joined the waitlist for ' else ' registered for ' end || left(e.title, 120),
    '#events/' || e.id);
  return query select t.code, v_status;
end;
$$;
revoke all on function public.forum_event_register_v2(uuid, jsonb) from public, anon;
grant execute on function public.forum_event_register_v2(uuid, jsonb) to authenticated;

-- The old one-click registration now asks for the full form.
create or replace function public.forum_event_register(p_event uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Please refresh the page and complete the registration form.';
end;
$$;

-- Move the earliest waitlisted guests into free places (automatic events only).
create or replace function public.forum_event_promote(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e forum_events; v_free bigint; r record;
begin
  select * into e from forum_events where id = p_event;
  if e.id is null or e.approval_required or e.status <> 'published' or e.ends_at < now() then return; end if;
  v_free := case when e.capacity is null then 1000000
    else e.capacity - (select count(*) from forum_tickets where event_id = p_event and status in ('registered', 'checked_in')) end;
  for r in select id, holder_id from forum_tickets where event_id = p_event and status = 'waitlisted' order by created_at limit greatest(v_free, 0) loop
    update forum_tickets set status = 'registered', decided_at = now() where id = r.id;
    insert into forum_notifications (user_id, kind, body, link)
    values (r.holder_id, 'event_update', 'A place opened up: you are now registered for "' || left(e.title, 120) || '".', '#events/' || e.id);
  end loop;
end;
$$;
revoke all on function public.forum_event_promote(uuid) from public, anon, authenticated;

create or replace function public.forum_ticket_cancel(p_ticket uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_event uuid;
begin
  update forum_tickets set status = 'cancelled'
  where id = p_ticket and holder_id = auth.uid() and status in ('registered', 'pending', 'waitlisted')
  returning event_id into v_event;
  if v_event is not null then perform public.forum_event_promote(v_event); end if;
end;
$$;
revoke all on function public.forum_ticket_cancel(uuid) from public, anon;
grant execute on function public.forum_ticket_cancel(uuid) to authenticated;

-- Host (or moderator) approves or declines a registration request or a waitlisted guest.
create or replace function public.forum_ticket_decide(p_ticket uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = public as $$
declare t forum_tickets; e forum_events; v_going bigint;
begin
  select * into t from forum_tickets where id = p_ticket for update;
  if t.id is null then raise exception 'Registration not found.'; end if;
  select * into e from forum_events where id = t.event_id;
  if not (public.whsf_is_staff() or e.host_id = auth.uid()) then raise exception 'Only the host can decide.' using errcode = '42501'; end if;
  if t.status not in ('pending', 'waitlisted') then raise exception 'This registration has already been decided.'; end if;
  if p_approve then
    select count(*) into v_going from forum_tickets where event_id = e.id and status in ('registered', 'checked_in');
    if e.capacity is not null and v_going >= e.capacity then raise exception 'The event is full. Increase the maximum number of guests first.'; end if;
    update forum_tickets set status = 'registered', decided_at = now() where id = t.id;
  else
    update forum_tickets set status = 'declined', decided_at = now() where id = t.id;
  end if;
  insert into forum_notifications (user_id, kind, body, link)
  values (t.holder_id, 'event_update',
    case when p_approve then 'Your registration for "' || left(e.title, 120) || '" is confirmed.'
         else 'Your registration request for "' || left(e.title, 110) || '" was not accepted.' end,
    '#events/' || e.id);
  return case when p_approve then 'registered' else 'declined' end;
end;
$$;
revoke all on function public.forum_ticket_decide(uuid, boolean) from public, anon;
grant execute on function public.forum_ticket_decide(uuid, boolean) to authenticated;

-- Check-in only for confirmed guests.
create or replace function public.forum_check_in(p_event uuid, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_ticket forum_tickets; v_name text;
begin
  if not (public.whsf_is_staff() or exists (select 1 from forum_events where id = p_event and host_id = auth.uid())) then
    raise exception 'Only the host can check guests in.' using errcode = '42501';
  end if;
  select * into v_ticket from forum_tickets where event_id = p_event and code = upper(btrim(p_code));
  if v_ticket.id is null then raise exception 'No ticket with that code for this event.'; end if;
  if v_ticket.status in ('cancelled', 'declined') then raise exception 'That ticket is not valid.'; end if;
  if v_ticket.status in ('pending', 'waitlisted') then raise exception 'That guest is not confirmed yet (%).', v_ticket.status; end if;
  select display_name into v_name from forum_profiles where user_id = v_ticket.holder_id;
  if v_ticket.status = 'checked_in' then return coalesce(v_name, 'Guest') || ' (already checked in)'; end if;
  update forum_tickets set status = 'checked_in', checked_in_at = now() where id = v_ticket.id;
  return coalesce(v_name, 'Guest');
end;
$$;

-- More places (capacity raised) or approval switched off: let waitlisted guests in.
create or replace function public.forum_event_capacity_promote()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.capacity is distinct from old.capacity or new.approval_required is distinct from old.approval_required then
    perform public.forum_event_promote(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists forum_event_capacity_promote on public.forum_events;
create trigger forum_event_capacity_promote after update of capacity, approval_required on public.forum_events
  for each row execute function public.forum_event_capacity_promote();
revoke all on function public.forum_event_capacity_promote() from public, anon, authenticated;
