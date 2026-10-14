-- WHSF Forum events: participant photo taken/uploaded at registration, shown on the ticket and to the
-- host at check-in so the person at the door can be identified. Private bucket; only the participant,
-- the event host and WHSF moderators can see a photo. Path: <event id>/<user id>/<random>.jpg|png|webp

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forum-event-photos', 'forum-event-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.forum_tickets
  add column if not exists photo_path text
    check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');

-- Participant uploads into their own folder for an open event they can register for.
drop policy if exists "Event photos: participant uploads" on storage.objects;
create policy "Event photos: participant uploads" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'forum-event-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.forum_is_member()
    and exists (select 1 from public.forum_events e where e.id::text = (storage.foldername(name))[1] and e.status = 'published' and e.ends_at > now())
  );
-- Participant, event host or moderator can view.
drop policy if exists "Event photos: participant, host or moderator views" on storage.objects;
create policy "Event photos: participant, host or moderator views" on storage.objects for select to authenticated
  using (
    bucket_id = 'forum-event-photos'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.whsf_is_staff()
      or exists (select 1 from public.forum_events e where e.id::text = (storage.foldername(name))[1] and e.host_id = auth.uid())
    )
  );
-- Participant (own), host (their event) or moderator can delete.
drop policy if exists "Event photos: participant, host or moderator deletes" on storage.objects;
create policy "Event photos: participant, host or moderator deletes" on storage.objects for delete to authenticated
  using (
    bucket_id = 'forum-event-photos'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.whsf_is_staff()
      or exists (select 1 from public.forum_events e where e.id::text = (storage.foldername(name))[1] and e.host_id = auth.uid())
    )
  );

-- Registration takes the photo path; it is required for in-person and hybrid events.
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
  v_photo text := nullif(btrim(coalesce(p_details->>'photo_path', '')), '');
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
  if v_type is null or v_type not in ('member_state', 'local_government', 'parliament', 'diplomatic', 'un_system', 'igo', 'ngo', 'international_ngo', 'cbo', 'faith_based', 'womens_org', 'youth_org', 'academia', 'student', 'educator', 'private_sector', 'startup', 'philanthropy', 'trade_union', 'farmers', 'indigenous', 'disability', 'older_persons', 'migrants', 'media', 'speaker', 'volunteer', 'individual', 'other') then
    raise exception 'Please choose how you are participating.';
  end if;
  if v_photo is not null and v_photo not like p_event::text || '/' || v_me::text || '/%' then
    raise exception 'Please add your photo again.';
  end if;
  if v_photo is null and e.format <> 'online' then
    raise exception 'Please add a clear photo of your face. It is shown on your ticket and used to identify you at check-in.';
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
  insert into forum_tickets (event_id, holder_id, code, status, organization, job_title, country, participant_type, access_needs, consent_at, photo_path)
  values (p_event, v_me, t.code, v_status, v_org, v_title, v_country, v_type, v_needs, now(), v_photo);
  select display_name into v_name from forum_profiles where user_id = v_me;
  insert into forum_notifications (user_id, kind, actor_id, body, link)
  values (e.host_id, 'event_registration', v_me,
    left(coalesce(v_name, 'A member'), 80) || case v_status when 'pending' then ' asked to join ' when 'waitlisted' then ' joined the waitlist for ' else ' registered for ' end || left(e.title, 120),
    '#events/' || e.id);
  return query select t.code, v_status;
end;
$$;

-- Participant replaces (or removes) their own photo; the host or a moderator can clear photos after the event.
create or replace function public.forum_ticket_set_photo(p_ticket uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare t forum_tickets; e forum_events; v_path text := nullif(btrim(coalesce(p_path, '')), '');
begin
  select * into t from forum_tickets where id = p_ticket;
  if t.id is null then raise exception 'Ticket not found.'; end if;
  select * into e from forum_events where id = t.event_id;
  if t.holder_id = auth.uid() then
    if v_path is not null and v_path not like t.event_id::text || '/' || auth.uid()::text || '/%' then raise exception 'Invalid photo.'; end if;
  elsif public.whsf_is_staff() or e.host_id = auth.uid() then
    if v_path is not null then raise exception 'Only the participant can add a photo.'; end if;
  else
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  update forum_tickets set photo_path = v_path where id = p_ticket;
end;
$$;
revoke all on function public.forum_ticket_set_photo(uuid, text) from public, anon;
grant execute on function public.forum_ticket_set_photo(uuid, text) to authenticated;
