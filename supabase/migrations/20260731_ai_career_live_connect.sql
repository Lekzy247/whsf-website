-- WHSF AI Career Connect: approval-first connection requests and public sessions.
-- Public callers can submit pending requests and read approved, non-sensitive sessions only.

create table if not exists public.ai_career_live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 180),
  description text not null default '',
  connection_type text not null,
  host_name text not null default '',
  host_organisation text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'UTC',
  delivery_mode text not null default 'Video meeting',
  public_location text not null default 'Online',
  registration_url text,
  meeting_url text,
  capacity integer check (capacity is null or capacity > 0),
  status text not null default 'draft' check (status in ('draft', 'approved', 'cancelled', 'completed')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.ai_career_live_connect_requests (
  id uuid primary key default gen_random_uuid(),
  requester_name text not null check (char_length(requester_name) between 2 and 100),
  email text not null check (char_length(email) between 5 and 160),
  requester_role text not null,
  organisation text not null default '',
  country text not null,
  connection_type text not null,
  topic text not null check (char_length(topic) between 3 and 180),
  preferred_start timestamptz not null,
  timezone text not null default 'UTC',
  delivery_mode text not null default 'Video meeting',
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'needs_changes', 'rejected', 'cancelled')),
  public_session_id uuid references public.ai_career_live_sessions(id) on delete set null,
  admin_notes text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_career_live_sessions_public_idx on public.ai_career_live_sessions (status, starts_at);
create index if not exists ai_career_live_requests_review_idx on public.ai_career_live_connect_requests (status, created_at desc);

alter table public.ai_career_live_sessions enable row level security;
alter table public.ai_career_live_connect_requests enable row level security;

create or replace function public.ai_career_live_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text in ('admin', 'super_admin')
  );
$$;

drop policy if exists "AI Career admins manage live sessions" on public.ai_career_live_sessions;
create policy "AI Career admins manage live sessions"
on public.ai_career_live_sessions for all to authenticated
using (public.ai_career_live_is_admin())
with check (public.ai_career_live_is_admin());

drop policy if exists "AI Career admins manage connection requests" on public.ai_career_live_connect_requests;
create policy "AI Career admins manage connection requests"
on public.ai_career_live_connect_requests for all to authenticated
using (public.ai_career_live_is_admin())
with check (public.ai_career_live_is_admin());

create or replace function public.ai_career_submit_live_connect_request(
  p_requester_name text,
  p_email text,
  p_requester_role text,
  p_organisation text,
  p_country text,
  p_connection_type text,
  p_topic text,
  p_preferred_start timestamptz,
  p_timezone text,
  p_delivery_mode text,
  p_notes text,
  p_website text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if nullif(trim(coalesce(p_website, '')), '') is not null then
    return jsonb_build_object('ok', true, 'status', 'pending', 'message', 'Request received for review.');
  end if;
  if char_length(trim(coalesce(p_requester_name, ''))) < 2
     or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or char_length(trim(coalesce(p_topic, ''))) < 3
     or p_preferred_start <= now() then
    raise exception 'Invalid Live Connect request';
  end if;

  insert into public.ai_career_live_connect_requests (
    requester_name, email, requester_role, organisation, country, connection_type,
    topic, preferred_start, timezone, delivery_mode, notes
  ) values (
    left(trim(p_requester_name), 100), lower(left(trim(p_email), 160)), left(trim(p_requester_role), 40),
    left(trim(coalesce(p_organisation, '')), 140), left(trim(p_country), 80), left(trim(p_connection_type), 60),
    left(trim(p_topic), 180), p_preferred_start, left(trim(coalesce(p_timezone, 'UTC')), 80),
    left(trim(coalesce(p_delivery_mode, 'Video meeting')), 40), left(trim(coalesce(p_notes, '')), 1200)
  ) returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'requestId', v_id, 'status', 'pending',
    'message', 'Request received. A WHSF administrator will review it before a session is scheduled.'
  );
end;
$$;

create or replace function public.ai_career_public_live_sessions(p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, title text, description text, connection_type text, host_name text,
  host_organisation text, starts_at timestamptz, ends_at timestamptz, timezone text,
  delivery_mode text, public_location text, registration_url text, capacity integer
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.title, s.description, s.connection_type, s.host_name,
    s.host_organisation, s.starts_at, s.ends_at, s.timezone,
    s.delivery_mode, s.public_location, s.registration_url, s.capacity
  from public.ai_career_live_sessions s
  where s.status = 'approved'
    and s.starts_at >= greatest(p_from, now() - interval '1 hour')
    and s.starts_at < p_to
  order by s.starts_at asc;
$$;

create or replace function public.ai_career_review_live_connect_request(
  p_request_id uuid,
  p_decision text,
  p_admin_notes text default '',
  p_public_session_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ai_career_live_is_admin() then raise exception 'Admin access required'; end if;
  if p_decision not in ('approved', 'needs_changes', 'rejected', 'cancelled') then raise exception 'Invalid decision'; end if;
  update public.ai_career_live_connect_requests
  set status = p_decision,
      admin_notes = left(trim(coalesce(p_admin_notes, '')), 1200),
      public_session_id = p_public_session_id,
      reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = p_request_id;
  if not found then raise exception 'Request not found'; end if;
  return jsonb_build_object('ok', true, 'requestId', p_request_id, 'status', p_decision);
end;
$$;

revoke all on public.ai_career_live_sessions from anon;
revoke all on public.ai_career_live_connect_requests from anon;
grant execute on function public.ai_career_submit_live_connect_request(text,text,text,text,text,text,text,timestamptz,text,text,text,text) to anon, authenticated;
grant execute on function public.ai_career_public_live_sessions(timestamptz,timestamptz) to anon, authenticated;
grant execute on function public.ai_career_review_live_connect_request(uuid,text,text,uuid) to authenticated;
grant execute on function public.ai_career_live_is_admin() to authenticated;
