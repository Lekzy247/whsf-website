-- WHSF Forum: mentorship. Mentor profiles, matching, mentorship requests, scheduled sessions, notes and feedback.

create table if not exists public.forum_mentors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pitch text not null check (char_length(btrim(pitch)) between 20 and 600),
  areas text[] not null check (cardinality(areas) between 1 and 10 and public.forum_text_items_ok(areas, 40)),
  languages text[] not null default '{English}' check (cardinality(languages) between 1 and 8 and public.forum_text_items_ok(languages, 30)),
  formats text[] not null default '{video}' check (cardinality(formats) >= 1 and formats <@ array['video', 'chat', 'in_person']),
  capacity int not null default 3 check (capacity between 1 and 20),
  availability text check (availability is null or char_length(availability) <= 200),
  booking_url text check (booking_url is null or (booking_url ~ '^https://[^\s]+$' and char_length(booking_url) <= 300)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.forum_mentors enable row level security;
revoke all on public.forum_mentors from anon, authenticated;
grant select, insert, update, delete on public.forum_mentors to authenticated;
drop policy if exists "Mentors: read" on public.forum_mentors;
create policy "Mentors: read" on public.forum_mentors for select to authenticated using (user_id = auth.uid() or public.forum_is_staff() or (is_active and public.forum_is_member()));
drop policy if exists "Mentors: own" on public.forum_mentors;
create policy "Mentors: own" on public.forum_mentors for insert to authenticated with check (user_id = auth.uid() and public.forum_is_member());
drop policy if exists "Mentors: own update" on public.forum_mentors;
create policy "Mentors: own update" on public.forum_mentors for update to authenticated using (user_id = auth.uid() or public.forum_is_staff()) with check (user_id = auth.uid() or public.forum_is_staff());
drop policy if exists "Mentors: own delete" on public.forum_mentors;
create policy "Mentors: own delete" on public.forum_mentors for delete to authenticated using (user_id = auth.uid() or public.forum_is_staff());

create table if not exists public.forum_mentorships (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references auth.users(id) on delete cascade,
  mentee_id uuid not null references auth.users(id) on delete cascade,
  goals text not null check (char_length(btrim(goals)) between 20 and 1000),
  status text not null default 'pending' check (status in ('pending', 'active', 'declined', 'completed', 'cancelled')),
  mentor_note text check (mentor_note is null or char_length(mentor_note) <= 500),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  ended_at timestamptz,
  check (mentor_id <> mentee_id)
);
create unique index if not exists forum_mentorships_open_pair on public.forum_mentorships (mentor_id, mentee_id) where status in ('pending', 'active');
alter table public.forum_mentorships enable row level security;
revoke all on public.forum_mentorships from anon, authenticated;
grant select on public.forum_mentorships to authenticated;
drop policy if exists "Mentorships: the two people" on public.forum_mentorships;
create policy "Mentorships: the two people" on public.forum_mentorships for select to authenticated
  using (((mentor_id = auth.uid() or mentee_id = auth.uid()) and public.forum_is_member()) or public.forum_is_staff());

create table if not exists public.forum_mentor_sessions (
  id uuid primary key default gen_random_uuid(),
  mentorship_id uuid not null references public.forum_mentorships(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_min int not null default 45 check (duration_min between 15 and 180),
  format text not null default 'video' check (format in ('video', 'chat', 'in_person')),
  link text check (link is null or (link ~ '^https://[^\s]+$' and char_length(link) <= 300)),
  agenda text check (agenda is null or char_length(agenda) <= 500),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  notes text check (notes is null or char_length(notes) <= 2000),
  rating int check (rating is null or rating between 1 and 5),
  feedback text check (feedback is null or char_length(feedback) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.forum_mentor_sessions enable row level security;
revoke all on public.forum_mentor_sessions from anon, authenticated;
grant select on public.forum_mentor_sessions to authenticated;
drop policy if exists "Sessions: the two people" on public.forum_mentor_sessions;
create policy "Sessions: the two people" on public.forum_mentor_sessions for select to authenticated using (
  public.forum_is_staff() or (public.forum_is_member() and exists (select 1 from public.forum_mentorships m
    where m.id = mentorship_id and (m.mentor_id = auth.uid() or m.mentee_id = auth.uid()))));

alter table public.forum_notifications drop constraint if exists forum_notifications_kind_check;
alter table public.forum_notifications add constraint forum_notifications_kind_check check (kind = any (array[
  'follow', 'message', 'id_approved', 'id_rejected', 'event_registration', 'event_update', 'advert_approved',
  'advert_rejected', 'invite_joined', 'reaction', 'comment', 'reply', 'security', 'mention',
  'connect_request', 'connect_accepted', 'collab_invite', 'collab_accepted',
  'org_verified', 'org_rejected', 'job_application', 'application_update',
  'mentor_request', 'mentor_accepted', 'mentor_declined', 'mentor_session']));

create or replace function public.forum_mentor_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select display_name from forum_profiles where user_id = p_user), 'A member');
$$;

create or replace function public.forum_mentor_request(p_mentor uuid, p_goals text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; m forum_mentors; v_active int;
begin
  if not public.forum_is_member() then raise exception 'Only verified members can request mentoring.' using errcode = '42501'; end if;
  if p_mentor = auth.uid() then raise exception 'You cannot mentor yourself.'; end if;
  select * into m from forum_mentors where user_id = p_mentor and is_active;
  if m.user_id is null or not exists (select 1 from forum_profiles where user_id = p_mentor and verification_status = 'approved' and not is_suspended) then
    raise exception 'This mentor is not available right now.';
  end if;
  if public.forum_is_blocked(auth.uid(), p_mentor) then raise exception 'This mentor is not available right now.'; end if;
  if char_length(btrim(coalesce(p_goals, ''))) < 20 then raise exception 'Tell the mentor what you want to achieve (at least a sentence).'; end if;
  select count(*) into v_active from forum_mentorships where mentor_id = p_mentor and status = 'active';
  if v_active >= m.capacity then raise exception 'This mentor is fully booked. Try another mentor or check back later.'; end if;
  if (select count(*) from forum_mentorships where mentee_id = auth.uid() and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'You can send up to 5 mentoring requests a day.';
  end if;
  begin
    insert into forum_mentorships (mentor_id, mentee_id, goals) values (p_mentor, auth.uid(), left(btrim(p_goals), 1000)) returning id into v_id;
  exception when unique_violation then
    raise exception 'You already have a request or mentorship with this mentor.';
  end;
  insert into forum_notifications (user_id, kind, actor_id, body, link)
  values (p_mentor, 'mentor_request', auth.uid(), left(public.forum_mentor_name(auth.uid()) || ' asked you to be their mentor', 300), '#mentorship/mine');
  return v_id;
end;
$$;

create or replace function public.forum_mentor_respond(p_id uuid, p_accept boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r forum_mentorships;
begin
  if not public.forum_is_member() then raise exception 'Members only.' using errcode = '42501'; end if;
  select * into r from forum_mentorships where id = p_id;
  if r.id is null or r.mentor_id <> auth.uid() or r.status <> 'pending' then raise exception 'This request is no longer waiting for you.'; end if;
  if p_accept and (select count(*) from forum_mentorships where mentor_id = auth.uid() and status = 'active') >= coalesce((select capacity from forum_mentors where user_id = auth.uid()), 0) then
    raise exception 'You are at your mentee limit. Raise it under Become a mentor, or end a mentorship first.';
  end if;
  update forum_mentorships set status = case when p_accept then 'active' else 'declined' end, responded_at = now(),
    mentor_note = nullif(left(btrim(coalesce(p_note, '')), 500), '') where id = p_id;
  insert into forum_notifications (user_id, kind, actor_id, body, link)
  values (r.mentee_id, case when p_accept then 'mentor_accepted' else 'mentor_declined' end, auth.uid(),
    left(public.forum_mentor_name(auth.uid()) || case when p_accept then ' accepted your mentoring request. Plan your first session.' else ' cannot mentor you right now. Try another mentor.' end, 300),
    '#mentorship/mine');
end;
$$;

create or replace function public.forum_mentorship_end(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r forum_mentorships;
begin
  if not public.forum_is_member() then raise exception 'Members only.' using errcode = '42501'; end if;
  select * into r from forum_mentorships where id = p_id;
  if r.id is null or auth.uid() not in (r.mentor_id, r.mentee_id) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if r.status = 'pending' and r.mentee_id = auth.uid() then
    update forum_mentorships set status = 'cancelled', ended_at = now() where id = p_id;
  elsif r.status = 'active' then
    update forum_mentorships set status = 'completed', ended_at = now() where id = p_id;
    update forum_mentor_sessions set status = 'cancelled' where mentorship_id = p_id and status = 'scheduled';
  else
    raise exception 'This mentorship is already closed.';
  end if;
end;
$$;

create or replace function public.forum_session_schedule(p_mentorship uuid, p_at timestamptz, p_minutes int, p_format text, p_link text, p_agenda text)
returns uuid language plpgsql security definer set search_path = public as $$
declare r forum_mentorships; v_id uuid; v_other uuid;
begin
  if not public.forum_is_member() then raise exception 'Members only.' using errcode = '42501'; end if;
  select * into r from forum_mentorships where id = p_mentorship;
  if r.id is null or auth.uid() not in (r.mentor_id, r.mentee_id) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if r.status <> 'active' then raise exception 'Sessions can be planned only in an active mentorship.'; end if;
  if p_at is null or p_at < now() or p_at > now() + interval '1 year' then raise exception 'Choose a date and time in the future.'; end if;
  if (select count(*) from forum_mentor_sessions where mentorship_id = p_mentorship and status = 'scheduled') >= 10 then
    raise exception 'There are already 10 upcoming sessions.';
  end if;
  insert into forum_mentor_sessions (mentorship_id, scheduled_at, duration_min, format, link, agenda, created_by)
  values (p_mentorship, p_at, coalesce(p_minutes, 45), coalesce(p_format, 'video'), nullif(btrim(coalesce(p_link, '')), ''), nullif(left(btrim(coalesce(p_agenda, '')), 500), ''), auth.uid())
  returning id into v_id;
  v_other := case when auth.uid() = r.mentor_id then r.mentee_id else r.mentor_id end;
  insert into forum_notifications (user_id, kind, actor_id, body, link)
  values (v_other, 'mentor_session', auth.uid(), left(public.forum_mentor_name(auth.uid()) || ' planned a mentoring session for ' || to_char(p_at at time zone 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC', 300), '#mentorship/mine');
  return v_id;
end;
$$;

create or replace function public.forum_session_update(p_id uuid, p_status text, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s forum_mentor_sessions; r forum_mentorships;
begin
  if not public.forum_is_member() then raise exception 'Members only.' using errcode = '42501'; end if;
  select * into s from forum_mentor_sessions where id = p_id;
  select * into r from forum_mentorships where id = s.mentorship_id;
  if s.id is null or auth.uid() not in (r.mentor_id, r.mentee_id) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if p_status not in ('scheduled', 'completed', 'cancelled') then raise exception 'Invalid status.'; end if;
  if p_status = 'completed' and s.scheduled_at > now() + interval '1 hour' then raise exception 'You can mark a session done once it has taken place.'; end if;
  update forum_mentor_sessions set status = p_status, notes = coalesce(nullif(left(btrim(coalesce(p_notes, '')), 2000), ''), notes) where id = p_id;
end;
$$;

create or replace function public.forum_session_feedback(p_id uuid, p_rating int, p_feedback text)
returns void language plpgsql security definer set search_path = public as $$
declare s forum_mentor_sessions; r forum_mentorships;
begin
  if not public.forum_is_member() then raise exception 'Members only.' using errcode = '42501'; end if;
  select * into s from forum_mentor_sessions where id = p_id;
  select * into r from forum_mentorships where id = s.mentorship_id;
  if s.id is null or r.mentee_id <> auth.uid() then raise exception 'Only the mentee can rate a session.' using errcode = '42501'; end if;
  if s.status <> 'completed' then raise exception 'Rate a session after it is marked done.'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Choose 1 to 5 stars.'; end if;
  update forum_mentor_sessions set rating = p_rating, feedback = nullif(left(btrim(coalesce(p_feedback, '')), 1000), '') where id = p_id;
end;
$$;

-- Mentors matched to me: overlap of their areas with my skills and interests, plus shared profile interests.
create or replace function public.forum_mentor_matches(p_limit int default 30, p_q text default null)
returns table (user_id uuid, display_name text, headline text, location text, avatar_url text, pitch text, areas text[], languages text[],
  formats text[], availability text, booking_url text, spots_left int, sessions_done bigint, rating numeric, score int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me forum_profiles; mine text[];
begin
  if not public.forum_is_member() then raise exception 'Members only.' using errcode = '42501'; end if;
  select * into me from forum_profiles where forum_profiles.user_id = auth.uid();
  mine := array(select lower(x) from unnest(coalesce(me.skills, '{}') || coalesce(me.interests, '{}')) x);
  return query
  select m.user_id, p.display_name, p.headline, p.location, p.avatar_url, m.pitch, m.areas, m.languages, m.formats, m.availability, m.booking_url,
    greatest(m.capacity - (select count(*) from forum_mentorships x where x.mentor_id = m.user_id and x.status = 'active')::int, 0),
    (select count(*) from forum_mentor_sessions s join forum_mentorships x on x.id = s.mentorship_id where x.mentor_id = m.user_id and s.status = 'completed'),
    (select round(avg(s.rating)::numeric, 1) from forum_mentor_sessions s join forum_mentorships x on x.id = s.mentorship_id where x.mentor_id = m.user_id and s.rating is not null),
    ((select count(*) from unnest(m.areas) a where lower(a) = any (mine))::int * 3
      + (select count(*) from unnest(p.interests) i where i = any (coalesce(me.interests, '{}')))::int)
  from forum_mentors m join forum_profiles p on p.user_id = m.user_id
  where m.is_active and m.user_id <> auth.uid() and p.verification_status = 'approved' and not p.is_suspended
    and not public.forum_is_blocked(auth.uid(), m.user_id)
    and (coalesce(btrim(p_q), '') = '' or p.display_name ilike '%' || btrim(p_q) || '%' or m.pitch ilike '%' || btrim(p_q) || '%'
      or exists (select 1 from unnest(m.areas) a where a ilike '%' || btrim(p_q) || '%'))
  order by 15 desc, 13 desc, p.display_name
  limit least(greatest(coalesce(p_limit, 30), 1), 60);
end;
$$;

revoke all on function public.forum_mentor_name(uuid) from public, anon;
revoke all on function public.forum_mentor_request(uuid, text) from public, anon;
revoke all on function public.forum_mentor_respond(uuid, boolean, text) from public, anon;
revoke all on function public.forum_mentorship_end(uuid) from public, anon;
revoke all on function public.forum_session_schedule(uuid, timestamptz, int, text, text, text) from public, anon;
revoke all on function public.forum_session_update(uuid, text, text) from public, anon;
revoke all on function public.forum_session_feedback(uuid, int, text) from public, anon;
revoke all on function public.forum_mentor_matches(int, text) from public, anon;
grant execute on function public.forum_mentor_request(uuid, text) to authenticated;
grant execute on function public.forum_mentor_respond(uuid, boolean, text) to authenticated;
grant execute on function public.forum_mentorship_end(uuid) to authenticated;
grant execute on function public.forum_session_schedule(uuid, timestamptz, int, text, text, text) to authenticated;
grant execute on function public.forum_session_update(uuid, text, text) to authenticated;
grant execute on function public.forum_session_feedback(uuid, int, text) to authenticated;
grant execute on function public.forum_mentor_matches(int, text) to authenticated;
