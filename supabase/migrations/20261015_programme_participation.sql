-- WHSF programmes -> participation: registrations from programme pages and public upcoming trainings.
-- Child safeguarding: Girls in ICT learners are children, so only a parent/guardian, teacher/school, partner or
-- volunteer can register for it, and no child's details are collected. Self-registration ("participant") for
-- the other programmes requires confirming the person is 18 or over.

create table if not exists public.whsf_programme_registrations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  programme text not null check (programme in ('digital_skills', 'girls_in_ict', 'robotics_drones', 'mil_lab')),
  role text not null check (role in ('participant', 'parent_guardian', 'teacher_school', 'partner_org', 'volunteer_mentor')),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  email text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(email) <= 254),
  country text not null check (char_length(btrim(country)) between 2 and 80),
  organisation text check (organisation is null or char_length(organisation) <= 160),
  message text check (message is null or char_length(message) <= 1000),
  adult_confirmed boolean not null default false,
  consent_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'contacted', 'enrolled', 'closed')),
  created_at timestamptz not null default now(),
  check (not (programme = 'girls_in_ict' and role = 'participant')),
  check (role <> 'participant' or adult_confirmed)
);
create index if not exists whsf_programme_registrations_email_idx on public.whsf_programme_registrations (lower(email), created_at desc);
alter table public.whsf_programme_registrations enable row level security;
revoke all on public.whsf_programme_registrations from anon, authenticated;
grant select, update on public.whsf_programme_registrations to authenticated;
drop policy if exists "Programme registrations: staff read" on public.whsf_programme_registrations;
create policy "Programme registrations: staff read" on public.whsf_programme_registrations for select to authenticated using (public.whsf_is_staff());
drop policy if exists "Programme registrations: staff update" on public.whsf_programme_registrations;
create policy "Programme registrations: staff update" on public.whsf_programme_registrations for update to authenticated using (public.whsf_is_staff()) with check (public.whsf_is_staff());

create or replace function public.whsf_programme_register(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_programme text := p ->> 'programme';
  v_role text := p ->> 'role';
  v_email text := lower(btrim(coalesce(p ->> 'email', '')));
  v_ref text;
begin
  if v_programme is null or v_programme not in ('digital_skills', 'girls_in_ict', 'robotics_drones', 'mil_lab') then raise exception 'Choose a programme.'; end if;
  if v_role is null or v_role not in ('participant', 'parent_guardian', 'teacher_school', 'partner_org', 'volunteer_mentor') then raise exception 'Choose how you are registering.'; end if;
  if v_programme = 'girls_in_ict' and v_role = 'participant' then
    raise exception 'Girls in ICT learners are registered by a parent, guardian, teacher or school.';
  end if;
  if v_role = 'participant' and coalesce((p ->> 'adult_confirmed')::boolean, false) is not true then
    raise exception 'Please confirm you are 18 or over. Younger learners are registered by a parent, guardian or teacher.';
  end if;
  if coalesce((p ->> 'consent')::boolean, false) is not true then raise exception 'Please agree to be contacted about this programme.'; end if;
  if (select count(*) from whsf_programme_registrations where lower(email) = v_email and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'You have already registered several times today. WHSF will contact you soon.';
  end if;
  v_ref := 'WHSF-P-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into whsf_programme_registrations (reference, programme, role, full_name, email, country, organisation, message, adult_confirmed)
  values (v_ref, v_programme, v_role, btrim(p ->> 'full_name'), v_email, btrim(p ->> 'country'),
    nullif(btrim(coalesce(p ->> 'organisation', '')), ''), nullif(btrim(coalesce(p ->> 'message', '')), ''),
    coalesce((p ->> 'adult_confirmed')::boolean, false));
  return v_ref;
end;
$$;
revoke all on function public.whsf_programme_register(jsonb) from public;
grant execute on function public.whsf_programme_register(jsonb) to anon, authenticated;

-- Upcoming trainings for a programme page (public details of published Forum events in that space).
create or replace function public.whsf_public_programme_events(p_space text)
returns table (id uuid, title text, starts_at timestamptz, time_zone text, format text, city text, country text, category text)
language sql stable security definer set search_path = public as $$
  select e.id, e.title, e.starts_at, e.time_zone, e.format, e.city, e.country, e.category
  from public.forum_events e
  where e.status = 'published' and e.ends_at > now() and e.space = p_space
  order by e.starts_at
  limit 4;
$$;
revoke all on function public.whsf_public_programme_events(text) from public;
grant execute on function public.whsf_public_programme_events(text) to anon, authenticated;
