-- Authenticated access to approved Live Connect rooms.
-- The public calendar never receives meeting_url; this RPC requires a signed-in WHSF user.

create or replace function public.ai_career_authenticated_live_session(p_session_id uuid)
returns table (
  id uuid, title text, description text, connection_type text, host_name text,
  host_organisation text, starts_at timestamptz, ends_at timestamptz, timezone text,
  delivery_mode text, public_location text, meeting_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.title, s.description, s.connection_type, s.host_name,
    s.host_organisation, s.starts_at, s.ends_at, s.timezone,
    s.delivery_mode, s.public_location, s.meeting_url
  from public.ai_career_live_sessions s
  where auth.uid() is not null
    and s.id = p_session_id
    and s.status = 'approved';
$$;

revoke all on function public.ai_career_authenticated_live_session(uuid) from public, anon;
grant execute on function public.ai_career_authenticated_live_session(uuid) to authenticated;
