-- WHSF Live Connect admin access and authenticated one-click request approval.

create or replace function public.ai_career_live_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'info@worldhsfoundation.org'
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role::text in ('admin', 'super_admin')
    );
$$;

create or replace function public.ai_career_quick_approve_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ai_career_live_is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.ai_career_live_connect_requests
  set status = 'approved',
      admin_notes = case
        when admin_notes = '' then 'Approved from authenticated WHSF email link.'
        else admin_notes
      end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_request_id
    and status in ('pending', 'approved')
    and public_session_id is null;

  if not found then raise exception 'Request is unavailable or already scheduled'; end if;
  return jsonb_build_object('ok', true, 'requestId', p_request_id, 'status', 'approved');
end;
$$;

revoke all on function public.ai_career_quick_approve_request(uuid) from public, anon;
grant execute on function public.ai_career_quick_approve_request(uuid) to authenticated;
grant execute on function public.ai_career_live_is_admin() to authenticated;
